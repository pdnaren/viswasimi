"""
Regression coverage for GET /api/curriculum/search (PRD §37 "Search"),
which previously didn't exist — the curriculum page only had client-side
filtering of already-loaded data.
"""
import uuid

from app.models.curriculum import Subject, Chapter, Topic


def signup_and_login(client, email="search-student@example.com", grade="CBSE-10"):
    client.post("/api/auth/signup", json={
        "name": "Search Student", "email": email, "password": "correct-horse-battery-staple", "grade": grade,
    })


def seed_curriculum(db_session, grade="CBSE-10"):
    subject = Subject(id=f"subj_{uuid.uuid4().hex}", grade=grade, name="Physics")
    db_session.add(subject)
    db_session.flush()
    chapter = Chapter(id=f"chap_{uuid.uuid4().hex}", subjectId=subject.id, name="Motion", order=1)
    db_session.add(chapter)
    db_session.flush()
    topic_a = Topic(id=f"top_{uuid.uuid4().hex}", chapterId=chapter.id, name="Newton's Laws", order=1, durationM=30, prereqIds=[])
    topic_b = Topic(id=f"top_{uuid.uuid4().hex}", chapterId=chapter.id, name="Free Fall", order=2, durationM=30, prereqIds=[])
    db_session.add_all([topic_a, topic_b])
    db_session.flush()
    return subject, chapter, topic_a, topic_b


def test_search_matches_topic_name(client, db_session):
    signup_and_login(client)
    seed_curriculum(db_session)

    res = client.get("/api/curriculum/search", params={"q": "newton"})
    assert res.status_code == 200
    body = res.json()
    assert body["query"] == "newton"
    names = [r["name"] for r in body["results"]]
    assert "Newton's Laws" in names
    assert "Free Fall" not in names


def test_search_matching_chapter_name_returns_all_its_topics(client, db_session):
    signup_and_login(client, email="chapter-search@example.com")
    seed_curriculum(db_session)

    res = client.get("/api/curriculum/search", params={"q": "motion"})
    body = res.json()
    names = {r["name"] for r in body["results"]}
    assert names == {"Newton's Laws", "Free Fall"}


def test_search_result_includes_breadcrumb_and_state(client, db_session):
    signup_and_login(client, email="breadcrumb-search@example.com")
    subject, chapter, topic_a, _ = seed_curriculum(db_session)

    res = client.get("/api/curriculum/search", params={"q": "newton"})
    hit = res.json()["results"][0]
    assert hit["subjectId"] == subject.id
    assert hit["chapterId"] == chapter.id
    assert hit["subjectName"] == "Physics"
    assert hit["chapterName"] == "Motion"
    assert "state" in hit and "mastery" in hit


def test_search_no_match_returns_empty_results(client, db_session):
    signup_and_login(client, email="no-match-search@example.com")
    seed_curriculum(db_session)

    res = client.get("/api/curriculum/search", params={"q": "quantum-chromodynamics"})
    assert res.json()["results"] == []


def test_search_requires_query_param(client):
    signup_and_login(client, email="missing-query@example.com")
    res = client.get("/api/curriculum/search")
    assert res.status_code == 422
