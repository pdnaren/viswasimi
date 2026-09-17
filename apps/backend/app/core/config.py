from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    """
    Application settings mapped directly from environment variables.
    FastAPI will throw an error on startup if required variables are missing.
    """
    ENVIRONMENT: str = "development"

    # Core Database
    DATABASE_URL: str

    # CORS
    ALLOWED_ORIGINS: str = "http://localhost:3000"

    # Auth / sessions
    SESSION_DAYS: int = 7
    COOKIE_SECURE: bool = False
    DEFAULT_LOCALE: str = "en-IN"
    DEFAULT_TIMEZONE: str = "Asia/Kolkata"
    APP_URL: str = "http://localhost:3000"

    # RAG backend integration — required because chat and admin ingestion
    # both send this as a header on every request to the RAG service.
    INTERNAL_API_KEY: str
    RAG_BACKEND_URL: str = "http://localhost:8001"
    MAX_UPLOAD_BYTES: int = 50 * 1024 * 1024  # 50 MB

    # Razorpay (payments) — optional; payment routes degrade gracefully if unset
    RAZORPAY_KEY_ID: str | None = None
    RAZORPAY_KEY_SECRET: str | None = None

    # Google OAuth ("Continue with Google") — optional; /api/auth/google/*
    # routes return 501 until all three are set. GOOGLE_REDIRECT_URI must be
    # the exact URI registered in Google Cloud Console, e.g.
    # https://<backend-domain>/api/auth/google/callback
    GOOGLE_CLIENT_ID: str | None = None
    GOOGLE_CLIENT_SECRET: str | None = None
    GOOGLE_REDIRECT_URI: str | None = None

    # Outgoing email (password reset) — optional; falls back to a dev preview
    SMTP_HOST: str | None = None
    SMTP_PORT: int = 587
    SMTP_USER: str | None = None
    SMTP_PASS: str | None = None

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