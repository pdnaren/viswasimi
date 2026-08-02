from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    """
    Application settings mapped directly from environment variables.
    FastAPI will throw an error on startup if required variables are missing.
    """
    # Core Database
    DATABASE_URL: str
    
    # External Services (Examples for your RAG architecture)
    SUPABASE_URL: str | None = None
    SUPABASE_KEY: str | None = None
    LLAMAPARSE_API_KEY: str | None = None
    OPENAI_API_KEY: str | None = None

    # This tells Pydantic to look for .env files in multiple locations, 
    # perfectly replacing your custom candidate search logic.
    model_config = SettingsConfigDict(
        env_file=(
            ".env", 
            ".env.local", 
            "../.env", 
            "../../.env", 
            "../../../.env"
        ),
        env_file_encoding="utf-8",
        extra="ignore" # Ignores extra env vars not defined in this class
    )

@lru_cache
def get_settings() -> Settings:
    """
    Uses lru_cache so we only read the .env files and validate 
    the settings once during the application lifecycle.
    """
    return Settings()

settings = get_settings()