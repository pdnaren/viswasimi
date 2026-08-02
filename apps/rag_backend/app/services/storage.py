import os
import re
import fitz
import httpx
import logging
import urllib.parse
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

try:
    import magic
    MAGIC_AVAILABLE = True
except ImportError:
    MAGIC_AVAILABLE = False


def sanitize_path_component(value: str) -> str:
    decoded = urllib.parse.unquote(value)
    sanitized = re.sub(r"[^\w\-.]", "_", decoded)
    sanitized = sanitized.replace("..", "_").lstrip(".")
    return sanitized or "unknown"


def validate_pdf_bytes(content: bytes) -> bool:
    if MAGIC_AVAILABLE:
        try:
            mime = magic.from_buffer(content[:2048], mime=True)
            return mime == "application/pdf"
        except Exception:
            pass
    return content[:4] == b"%PDF"


async def upload_to_supabase(
    image_bytes: bytes, storage_path: str, content_type: str
) -> Optional[str]:
    storage_path = storage_path.replace("\n", "").replace("\r", "").strip()
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
        logger.error("Supabase credentials missing.")
        return None
    
    url = f"{settings.SUPABASE_URL}/storage/v1/object/textbook-assets/{storage_path}"
    headers = {
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": content_type,
        "x-upsert": "true",
    }
    
    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            resp = await client.post(url, content=image_bytes, headers=headers)
            if resp.status_code in (200, 201):
                public_url = (
                    f"{settings.SUPABASE_URL}/storage/v1/object/public"
                    f"/textbook-assets/{storage_path}"
                )
                logger.info(f"Supabase upload OK ({resp.status_code}): {public_url}")
                return public_url
            logger.error(f"Supabase error ({resp.status_code}): {resp.text}")
            return None
        except Exception as exc:
            logger.error(f"Supabase upload exception: {exc}")
            return None


async def extract_page_images(
    doc: fitz.Document,
    safe_grade: str,
    safe_subject: str,
    safe_topic: str,
    safe_filename: str,
) -> dict[int, list[str]]:
    page_image_map: dict[int, list[str]] = {}

    for page in doc:
        pnum_1 = page.number + 1
        try:
            has_images = len(page.get_image_info()) > 0
            has_tables = len(page.find_tables().tables) > 0
            has_drawings = any(
                fitz.Rect(d["rect"]).width > 80 and fitz.Rect(d["rect"]).height > 80
                for d in page.get_drawings()
            )

            if not (has_images or has_tables or has_drawings):
                logger.info(f"  Page {pnum_1}: no meaningful visuals, skipping.")
                continue

            pix = page.get_pixmap(dpi=150)
            img_bytes = pix.tobytes("png")

            if len(img_bytes) < 10000:
                logger.info(
                    f"  Page {pnum_1}: rendered image too small "
                    f"({len(img_bytes)} bytes), skipping."
                )
                continue

            path = (
                f"{safe_grade}/{safe_subject}/{safe_topic}"
                f"/{safe_filename}_p{pnum_1}.png"
            ).replace("\n", "").replace("\r", "").replace(" ", "_")

            url = await upload_to_supabase(img_bytes, path, "image/png")
            if url:
                url = url.replace("\n", "").replace("\r", "").strip()
                page_image_map[pnum_1] = [url]
                logger.info(f"  Page {pnum_1}: full-page image uploaded ✓")

        except Exception as exc:
            logger.warning(f"  Page {pnum_1} image extraction failed: {exc}")

    return page_image_map