"""
Regression coverage for GET /api/notifications (PRD §36), which previously
didn't exist. Computed on demand from existing Mastery/StudyPlan/PlanItem
data rather than persisted or pushed — see the module docstring in
app/api/routes/notifications.py for why.
"""
import uuid
from datetime import timedelta

from app.api.dependencies import now_utc, _to_naive_utc
from app.models.curriculum import Subject, Chapter, Topic
from app.models.progress import Mastery
from app.models.tutoring import StudyPlan, PlanItem
from app.models.user import User


def make_user(db_session, email="notif-student@example.com"):
    user = User(
        id=f"user_{uuid.uuid4().hex}", role="STUDENT", grade="CBSE-10", name="Notif Student",
        email=email, passwordHash="unused", locale="en-IN", timezone="Asia/Kolkata",
        createdAt=_to_naive_utc(now_utc()),
    )
    db_session.add(user)
    db_session.flush()
    return user


def make_topic(db_session, grade="CBSE-10"):
    subject = Subject(id=f"subj_{uuid.uuid4().hex}", grade=grade, name="Physics")
    db_session.add(subject)
    db_session.flush()
    chapter = Chapter(id=f"chap_{uuid.uuid4().hex}", subjectId=subject.id, name="Motion", order=1)
    db_session.add(chapter)
    db_session.flush()
    topic = Topic(id=f"top_{uuid.uuid4().hex}", chapterId=chapter.id, name="Uniform Motion", order=1, durationM=30, prereqIds=[])
    db_session.add(topic)
    db_session.flush()
    return topic


def _auth_client(client, db_session, user):
    """Users here are inserted directly, not via /api/auth/signup, so
    authenticate by creating a Session row and sending it as a Bearer
    token instead."""
    from app.models.auth import Session
    session = Session(
        id=f"sess_{uuid.uuid4().hex}", userId=user.id, token=f"tok_{uuid.uuid4().hex}",
        createdAt=_to_naive_utc(now_utc()), expiresAt=_to_naive_utc(now_utc() + timedelta(days=1)),
    )
    db_session.add(session)
    db_session.flush()
    client.headers.update({"Authorization": f"Bearer {session.token}"})
    return client


def test_no_notifications_when_nothing_due(client, db_session):
    user = make_user(db_session)
    _auth_client(client, db_session, user)

    res = client.get("/api/notifications")
    assert res.status_code == 200
    assert res.json()["notifications"] == []


def test_revision_due_notification(client, db_session):
    user = make_user(db_session)
    topic = make_topic(db_session)
    db_session.add(Mastery(
        id=f"mast_{uuid.uuid4().hex}", userId=user.id, topicId=topic.id, value=2, ef=2.5, streak=1,
        nextReviewAt=_to_naive_utc(now_utc() - timedelta(days=1)),
    ))
    db_session.flush()
    _auth_client(client, db_session, user)

    res = client.get("/api/notifications")
    notifications = res.json()["notifications"]
    assert len(notifications) == 1
    assert notifications[0]["type"] == "REVISION_DUE"
    assert notifications[0]["topicId"] == topic.id


def test_overdue_lesson_takes_priority_over_daily_ready(client, db_session):
    user = make_user(db_session)
    topic = make_topic(db_session)
    plan = StudyPlan(id=f"plan_{uuid.uuid4().hex}", userId=user.id, active=True)
    db_session.add(plan)
    db_session.flush()

    yesterday = _to_naive_utc(now_utc()) - timedelta(days=1)
    db_session.add(PlanItem(
        id=f"pi_{uuid.uuid4().hex}", planId=plan.id, topicId=topic.id,
        startsAt=yesterday, endsAt=yesterday + timedelta(minutes=30), state="SCHEDULED", targetMastery=5,
    ))
    db_session.flush()
    _auth_client(client, db_session, user)

    res = client.get("/api/notifications")
    notifications = res.json()["notifications"]
    assert len(notifications) == 1
    assert notifications[0]["type"] == "LESSON_INCOMPLETE"


def test_daily_lesson_ready_when_nothing_overdue(client, db_session):
    user = make_user(db_session)
    topic = make_topic(db_session)
    plan = StudyPlan(id=f"plan_{uuid.uuid4().hex}", userId=user.id, active=True)
    db_session.add(plan)
    db_session.flush()

    today = _to_naive_utc(now_utc())
    db_session.add(PlanItem(
        id=f"pi_{uuid.uuid4().hex}", planId=plan.id, topicId=topic.id,
        startsAt=today, endsAt=today + timedelta(minutes=30), state="SCHEDULED", targetMastery=5,
    ))
    db_session.flush()
    _auth_client(client, db_session, user)

    res = client.get("/api/notifications")
    notifications = res.json()["notifications"]
    assert len(notifications) == 1
    assert notifications[0]["type"] == "DAILY_LESSON_READY"
    assert notifications[0]["topicId"] == topic.id
