from sqlalchemy import create_engine
from langchain_postgres.vectorstores import PGVector
from app.core.config import settings
from app.core.llm import embeddings

db_url = settings.DATABASE_URL
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

engine = create_engine(
    db_url,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
    pool_recycle=300,
)

vector_store = PGVector(
    embeddings=embeddings,
    collection_name="viswasimi_curriculum",
    connection=engine,
    use_jsonb=True,
)