from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    DATABASE_URL: str
    SUPABASE_URL: str | None = None
    SUPABASE_SERVICE_ROLE_KEY: str | None = None
    LLAMA_CLOUD_API_KEY: str | None = None
    OPENAI_API_KEY: str
    INTERNAL_API_KEY: str
    MAX_UPLOAD_BYTES: int = 50 * 1024 * 1024  # 50 MB
    LLAMAPARSE_CONCURRENCY: int = 5
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:8000"

    model_config = SettingsConfigDict(
        env_file=(".env", ".env.local", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

@lru_cache
def get_settings() -> Settings:
    return Settings()

settings = get_settings()