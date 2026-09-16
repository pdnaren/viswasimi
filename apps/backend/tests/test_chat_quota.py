"""
Regression coverage for the free-tier daily chat quota
(app/api/routes/chat.py).

count_free_tier_messages_today used to combine func.count() with
.with_for_update(), which Postgres flatly rejects ("FOR UPDATE is not
allowed with aggregate functions") — every chat request from a free user
would 500. test_count_free_tier_messages_today_executes_without_error runs
the exact production query against a real Postgres database, so it fails
loudly if that combination is ever reintroduced. SQLite wouldn't catch
this — the restriction is Postgres-specific — which is why these tests
require a real database (see conftest.py).
"""
import uuid
from datetime import datetime, timedelta, timezone

from app.api.routes.chat import count_free_tier_messages_today, get_ist_day_start_utc
from app.models.user import User
from app.models.tutoring import ChatMessage


def make_user(db_session, **overrides):
    user = User(
        id=f"user_{uuid.uuid4().hex}",
        role="STUDENT",
        grade="CBSE-10",
        name="Quota Test User",
        email=f"{uuid.uuid4().hex}@example.com",
        passwordHash="unused-in-this-test",
        locale="en-IN",
        timezone="Asia/Kolkata",
        createdAt=datetime.utcnow(),
    )
    for key, value in overrides.items():
        setattr(user, key, value)
    db_session.add(user)
    db_session.flush()
    return user


def add_message(db_session, user_id, created_at):
    db_session.add(ChatMessage(
        id=str(uuid.uuid4()),
        userId=user_id,
        topicId="topic_1",
        role="user",
        content="hi",
        createdAt=created_at,
    ))


def test_get_ist_day_start_utc_matches_local_midnight():
    # 2024-06-15 10:00 UTC is 2024-06-15 15:30 IST, so IST midnight that day
    # is 2024-06-14 18:30 UTC.
    reference = datetime(2024, 6, 15, 10, 0, tzinfo=timezone.utc)
    result = get_ist_day_start_utc(reference)
    assert result == datetime(2024, 6, 14, 18, 30, 0)


def test_count_free_tier_messages_today_executes_without_error(db_session):
    """The real regression guard: this is the exact query pattern used by
    chat_respond's daily-limit check, run against a live Postgres database."""
    user = make_user(db_session)
    add_message(db_session, user.id, datetime.now(timezone.utc))
    db_session.flush()

    count = count_free_tier_messages_today(db_session, user.id)
    assert count == 1


def test_count_free_tier_messages_today_excludes_yesterday(db_session):
    user = make_user(db_session)
    now_utc = datetime.now(timezone.utc)
    add_message(db_session, user.id, now_utc)  # today, should count
    add_message(db_session, user.id, now_utc - timedelta(hours=30))  # yesterday, should not
    db_session.flush()

    assert count_free_tier_messages_today(db_session, user.id) == 1


def test_count_free_tier_messages_today_ignores_assistant_messages(db_session):
    user = make_user(db_session)
    now_utc = datetime.now(timezone.utc)
    add_message(db_session, user.id, now_utc)
    db_session.add(ChatMessage(
        id=str(uuid.uuid4()), userId=user.id, topicId="topic_1",
        role="assistant", content="hello", createdAt=now_utc,
    ))
    db_session.flush()

    assert count_free_tier_messages_today(db_session, user.id) == 1
