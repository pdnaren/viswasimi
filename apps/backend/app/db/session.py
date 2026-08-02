from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Import our new central settings object
from app.core.config import settings 

# We no longer need manual os.getenv checks because Pydantic 
# guarantees settings.DATABASE_URL exists and is valid.
engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)