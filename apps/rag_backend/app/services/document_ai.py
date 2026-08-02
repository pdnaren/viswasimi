import re
import fitz
import httpx
import asyncio
import logging
from langchain_core.documents import Document

from app.core.config import settings

logger = logging.getLogger(__name__)

_PAGE_MARKER_RE = re.compile(r"(?im)^---\s*PAGE\s+\d+\s*---\s*$")


def strip_page_markers(text: str) -> str:
    return _PAGE_MARKER_RE.sub("", text).strip()


async def llamaparse_single_page(
    client: httpx.AsyncClient,
    page_pdf_bytes: bytes,
    filename: str,
    page_num: int,
    semaphore: asyncio.Semaphore,
) -> str:
    base_url = "https://api.cloud.llamaindex.ai/api/parsing"
    lp_auth = {"Authorization": f"Bearer {settings.LLAMA_CLOUD_API_KEY}"}

    parsing_instruction = (
        "Process this single textbook page with these rules:\n"
        "1. Extract ALL text content exactly as it appears.\n"
        "2. Format ALL mathematical expressions using $...$ for inline math "
        "   and $$...$$ for display equations. Never use \\[ \\] or \\( \\).\n"
        "3. Preserve tables in Markdown table format.\n"
        "4. For figures or diagrams write: [Figure: <brief description>].\n"
        "5. Do NOT add any page number markers or section headers of your own.\n"
        "6. Maintain reading order for multi-column layouts "
        "   (left column first, then right column).\n"
    )

    async with semaphore:
        try:
            upload_res = await client.post(
                f"{base_url}/upload",
                headers=lp_auth,
                files={"file": (filename, page_pdf_bytes, "application/pdf")},
                data={
                    "premium_mode": "true",
                    "parsing_instruction": parsing_instruction,
                },
                timeout=60.0,
            )
            if upload_res.status_code != 200:
                logger.error(
                    f"  Page {page_num}: LlamaParse upload failed "
                    f"({upload_res.status_code}): {upload_res.text[:200]}"
                )
                return ""

            job_id = upload_res.json().get("id", "")
            if not re.match(r"^[a-zA-Z0-9\-_]{1,128}$", job_id):
                logger.error(f"  Page {page_num}: invalid LlamaParse job ID: {job_id!r}")
                return ""

            logger.info(f"  Page {page_num}: LlamaParse job {job_id} submitted.")

            deadline = asyncio.get_event_loop().time() + 300
            while True:
                if asyncio.get_event_loop().time() > deadline:
                    logger.error(f"  Page {page_num}: LlamaParse timed out.")
                    return ""
                await asyncio.sleep(4)
                status_res = await client.get(
                    f"{base_url}/job/{job_id}", headers=lp_auth, timeout=30.0
                )
                status = status_res.json().get("status", "")
                if status == "SUCCESS":
                    break
                if status == "ERROR":
                    logger.error(f"  Page {page_num}: LlamaParse job errored.")
                    return ""

            result_res = await client.get(
                f"{base_url}/job/{job_id}/result/markdown",
                headers=lp_auth,
                timeout=30.0,
            )
            raw_markdown = result_res.json().get("markdown", "")
            clean = strip_page_markers(raw_markdown)
            logger.info(f"  Page {page_num}: parsed OK ({len(clean)} chars). ✓")
            return clean

        except Exception as exc:
            logger.error(f"  Page {page_num}: LlamaParse exception: {exc}")
            return ""


async def parse_all_pages(
    pdf_doc: fitz.Document,
    base_filename: str,
) -> dict[int, str]:
    total_pages = len(pdf_doc)
    semaphore = asyncio.Semaphore(settings.LLAMAPARSE_CONCURRENCY)
    results: dict[int, str] = {}

    async with httpx.AsyncClient(timeout=400.0) as client:

        async def parse_one(page_num: int) -> tuple[int, str]:
            single = fitz.open()
            try:
                single.insert_pdf(pdf_doc, from_page=page_num - 1, to_page=page_num - 1)
                page_bytes = single.tobytes()
            finally:
                single.close()

            fname = f"{base_filename}_p{page_num}.pdf"
            text = await llamaparse_single_page(
                client, page_bytes, fname, page_num, semaphore
            )

            if not text:
                logger.warning(
                    f"  Page {page_num}: LlamaParse returned empty, falling back to PyMuPDF."
                )
                fitz_page = pdf_doc[page_num - 1]
                text = fitz_page.get_text("text").strip()

            if not text:
                text = "[Figure: This page contains visual content but no extractable text.]"

            return page_num, text

        tasks = [parse_one(p) for p in range(1, total_pages + 1)]
        for coro in asyncio.as_completed(tasks):
            page_num, text = await coro
            results[page_num] = text
            logger.info(f"  Collected page {page_num} ({len(results)}/{total_pages})")

    return results


def heading_from_page_text(page_text: str, fallback: str = "General Topic") -> str:
    for line in page_text.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith("#"):
            return stripped.lstrip("#").strip() or fallback
        if (
            not stripped.startswith(("|", "-", "[Figure:", "---"))
            and len(stripped) <= 100
        ):
            return stripped
    return fallback


def build_documents_from_pages(
    page_texts: dict[int, str],
    page_image_map: dict[int, list[str]],
    grade: str,
    subject: str,
    chapterId: str,
    topicId: str,
    filename: str,
) -> list[Document]:
    final_docs = []

    for chunk_index, page_num in enumerate(sorted(page_texts.keys())):
        page_text = page_texts[page_num].strip()
        if not page_text:
            page_text = "[Figure: This page contains visual content but no extractable text.]"

        heading = heading_from_page_text(page_text)
        chunk_images = [url for url in page_image_map.get(page_num, []) if url]
        safe_text = page_text.replace("{", "{{").replace("}", "}}")

        doc_metadata = {
            "grade": grade,
            "subject": subject,
            "chapterId": chapterId,
            "topicId": topicId,
            "source": filename,
            "chunk_index": chunk_index,
            "page_start": page_num,
            "page_end": page_num,
            "heading": heading,
            "images": chunk_images,
            "part_index_on_page": 0,
            "parts_on_page": 1,
        }

        final_docs.append(Document(
            page_content=f"## {heading}\n\n[Page {page_num}]\n\n{safe_text}",
            metadata=doc_metadata,
        ))

        logger.info(
            f"  Chunk [{chunk_index}] page={page_num} | "
            f"'{heading[:50]}' | {len(chunk_images)} image(s) | {len(safe_text)} chars"
        )

    return final_docs