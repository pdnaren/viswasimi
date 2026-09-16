"""
Shared test fixtures.

These tests need a real Postgres database — the app's models use
Postgres-specific types (e.g. ARRAY on Topic.prereqIds) and the bug these
tests exist to catch (FOR UPDATE combined with an aggregate query) is a
Postgres-specific restriction that SQLite won't reproduce. Point
TEST_DATABASE_URL (or DATABASE_URL) at a scratch Postgres database — CI
does this via a postgres service container (see .github/workflows/ci.yml).
If no database is reachable, the whole suite is skipped rather than
failing, so `pytest` still works for contributors without Postgres set up
locally.
"""
import os

import pytest
from sqlalchemy import create_engine
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

os.environ.setdefault("INTERNAL_API_KEY", "test-internal-key")
os.environ.setdefault("OPENAI_API_KEY", "sk-test")
os.environ.setdefault("ENVIRONMENT", "development")

TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL") or os.getenv(
    "DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/viswasimi_test"
)
os.environ["DATABASE_URL"] = TEST_DATABASE_URL


@pytest.fixture(scope="session")
def db_engine():
    from app.db.base import Base
    import app.models  # noqa: F401 — registers every model on Base.metadata

    engine = create_engine(TEST_DATABASE_URL)
    try:
        with engine.connect():
            pass
    except OperationalError as exc:
        pytest.skip(f"No test Postgres database reachable at {TEST_DATABASE_URL}: {exc}")

    Base.metadata.create_all(engine)
    yield engine
    Base.metadata.drop_all(engine)
    engine.dispose()


@pytest.fixture()
def db_session(db_engine):
    """A fresh session per test, wrapped in a transaction that's always
    rolled back so tests never see each other's data."""
    connection = db_engine.connect()
    transaction = connection.begin()
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=connection)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture()
def client(db_session):
    from app.main import app
    from app.api.dependencies import get_db

    def _get_db_override():
        yield db_session

    app.dependency_overrides[get_db] = _get_db_override
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()
