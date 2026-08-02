import os
import fitz
import logging
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from sqlalchemy import text

from app.api.dependencies import require_internal_key
from app.core.config import settings
from app.db.vector_store import engine, vector_store
from app.services.document_ai import build_documents_from_pages, parse_all_pages
from app.services.storage import extract_page_images, sanitize_path_component, validate_pdf_bytes

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/ingest")
async def ingest_pdf(
    request: Request,
    file: UploadFile = File(...),
    grade: str = Form(...),
    subject: str = Form(...),
    chapterId: str = Form(...),
    topicId: str = Form(...),
    _: None = Depends(require_internal_key),
):
    if not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDF files are allowed")

    doc = None
    try:
        logger.info(f"=== Ingestion v5.3 started: {file.filename} ===")

        if not settings.LLAMA_CLOUD_API_KEY:
            raise ValueError("LLAMA_CLOUD_API_KEY not set")

        pdf_bytes = await file.read(settings.MAX_UPLOAD_BYTES + 1)
        if len(pdf_bytes) > settings.MAX_UPLOAD_BYTES:
            raise HTTPException(413, "File too large. Maximum is 50 MB.")
        if not validate_pdf_bytes(pdf_bytes):
            raise HTTPException(400, "Uploaded file is not a valid PDF.")

        safe_grade = sanitize_path_component(grade)
        safe_subject = sanitize_path_component(subject)
        safe_topic = sanitize_path_component(topicId)
        safe_filename = sanitize_path_component(
            os.path.basename(file.filename or "upload.pdf")
        )

        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        total_pages = len(doc)
        logger.info(f"  PDF has {total_pages} pages (PyMuPDF ground truth).")

        # Phase 1a — PyMuPDF: render and upload page images
        page_image_map = await extract_page_images(
            doc, safe_grade, safe_subject, safe_topic, safe_filename
        )
        total_images = sum(len(v) for v in page_image_map.values())

        # Phase 2 — Per-page LlamaParse
        page_texts = await parse_all_pages(doc, safe_filename)

        # Phase 3 — One Document per page
        all_documents = build_documents_from_pages(
            page_texts=page_texts,
            page_image_map=page_image_map,
            grade=grade,
            subject=subject,
            chapterId=chapterId,
            topicId=topicId,
            filename=file.filename or "upload.pdf",
        )

        # Phase 4 — Store in vector DB
        with engine.begin() as conn:
            conn.execute(
                text(
                    "DELETE FROM langchain_pg_embedding "
                    "WHERE cmetadata->>'topicId' = :tid"
                ),
                {"tid": topicId},
            )

        BATCH_SIZE = 20
        for i in range(0, len(all_documents), BATCH_SIZE):
            vector_store.add_documents(all_documents[i : i + BATCH_SIZE])

        logger.info("=== Ingestion v5.3 complete ===")

        return {
            "ok": True,
            "chunks": len(all_documents),
            "images_extracted": total_images,
            "strategy": "per_page_llamaparse",
            "sections": [
                {
                    "index": d.metadata["chunk_index"],
                    "heading": d.metadata["heading"],
                    "page": d.metadata["page_start"],
                    "images": len(d.metadata["images"]),
                }
                for d in all_documents
            ],
        }

    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Ingest error: {exc}", exc_info=True)
        raise HTTPException(500, "PDF processing failed. Please try again.")
    finally:
        if doc:
            doc.close()