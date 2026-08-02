import logging
from fastapi import Request, HTTPException
from app.core.config import settings

logger = logging.getLogger(__name__)

def require_internal_key(request: Request):
    provided = request.headers.get("X-Internal-Key", "")
    if not provided or provided != settings.INTERNAL_API_KEY:
        logger.warning(f"Unauthorized RAG access attempt from {request.client.host}")
        raise HTTPException(status_code=401, detail="Unauthorized")