import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import ask, ingest, quiz
from app.core.config import settings

app = FastAPI(title="Viswasimi RAG v5.3", version="5.3")

ALLOWED_ORIGINS = [o.strip() for o in settings.ALLOWED_ORIGINS.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["POST", "GET"],
    allow_headers=["Content-Type", "X-Internal-Key"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/api/health")
def api_health():
    return {"status": "ok"}


app.include_router(ingest.router, prefix="/api", tags=["Ingestion"])
app.include_router(ask.router, prefix="/api", tags=["RAG Chat"])
app.include_router(quiz.router, prefix="/api", tags=["Quiz Generation"])

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8001, reload=True)