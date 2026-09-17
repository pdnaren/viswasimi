"""
Regression coverage for the Parent Dashboard (PRD §33), implemented as a
student-generated, revocable, unguessable read-only link rather than a
full parent-account system — see README 'Parent Dashboard' for why.
"""
import uuid
from datetime import timedelta

from app.api.dependencies import now_utc, _to_naive_utc
from app.models.curriculum import Subject, Chapter, Topic
from app.models.progress import Mastery, DailyProgress
from app.models.tutoring import StudyPlan, PlanItem


def signup_and_login(client, email="parent-link-student@example.com", grade="CBSE-10"):
    client.post("/api/auth/signup", json={
        "name": "Parent Link Student", "email": email, "password": "correct-horse-battery-staple", "grade": grade,
    })


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
    return subject, chapter, topic


def test_create_and_list_parent_link(client):
    signup_and_login(client)
    res = client.post("/api/parent/tokens", json={"label": "Mom"})
    assert res.status_code == 201
    body = res.json()
    assert body["token"]
    assert body["label"] == "Mom"

    listed = client.get("/api/parent/tokens").json()["tokens"]
    assert len(listed) == 1
    assert listed[0]["token"] == body["token"]


def test_revoked_link_is_not_listed_and_view_returns_404(client):
    signup_and_login(client, email="revoke-check@example.com")
    created = client.post("/api/parent/tokens", json={}).json()

    res = client.delete(f"/api/parent/tokens/{created['id']}")
    assert res.status_code == 200

    assert client.get("/api/parent/tokens").json()["tokens"] == []

    view = client.get(f"/api/parent/view/{created['token']}")
    assert view.status_code == 404


def test_unknown_token_returns_404(client):
    res = client.get("/api/parent/view/not-a-real-token")
    assert res.status_code == 404


def test_parent_view_requires_no_auth_and_shows_progress(client, db_session):
    signup_and_login(client, email="view-progress@example.com")
    created = client.post("/api/parent/tokens", json={}).json()

    from app.models.user import User
    student = db_session.query(User).filter(User.email == "view-progress@example.com").one()
    subject, chapter, topic = make_topic(db_session)

    db_session.add(Mastery(id=f"mast_{uuid.uuid4().hex}", userId=student.id, topicId=topic.id, value=5, ef=2.5, streak=2))
    db_session.add(DailyProgress(
        id=f"dp_{uuid.uuid4().hex}", userId=student.id,
        date=_to_naive_utc(now_utc()).replace(hour=0, minute=0, second=0, microsecond=0),
        topicsCompleted=1, minutes=45, streak=3,
    ))
    db_session.flush()

    # The route has no get_current_user dependency at all — the token alone
    # is the access control, so this must succeed with no session involved.
    res = client.get(f"/api/parent/view/{created['token']}")
    assert res.status_code == 200
    body = res.json()
    assert body["studentName"] == "Parent Link Student"
    assert body["streak"] == 3
    assert body["studyTimeMinutes7d"] == 45
    assert body["topicsCompleted"] == 1
    assert body["topicsTotal"] == 1
    assert body["subjectMastery"][0]["name"] == "Physics"
    assert body["subjectMastery"][0]["mastery"] == 100


def test_parent_view_lists_upcoming_lessons(client, db_session):
    signup_and_login(client, email="upcoming-check@example.com")
    created = client.post("/api/parent/tokens", json={}).json()

    from app.models.user import User
    student = db_session.query(User).filter(User.email == "upcoming-check@example.com").one()
    _, _, topic = make_topic(db_session)

    plan = StudyPlan(id=f"plan_{uuid.uuid4().hex}", userId=student.id, active=True)
    db_session.add(plan)
    db_session.flush()
    starts_at = _to_naive_utc(now_utc()) + timedelta(hours=2)
    db_session.add(PlanItem(
        id=f"pi_{uuid.uuid4().hex}", planId=plan.id, topicId=topic.id,
        startsAt=starts_at, endsAt=starts_at + timedelta(minutes=30), state="SCHEDULED", targetMastery=5,
    ))
    db_session.flush()

    res = client.get(f"/api/parent/view/{created['token']}")
    upcoming = res.json()["upcomingLessons"]
    assert len(upcoming) == 1
    assert upcoming[0]["topicName"] == "Uniform Motion"
