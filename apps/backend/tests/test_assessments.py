"""
Regression coverage for the Assessment System (app/api/routes/assessments.py),
added to cover PRD §31/§32 ("Topic quiz", "Chapter test", score + weak-area
report) which previously had no standalone implementation — only a single
in-teaching checkpoint question existed.

httpx.AsyncClient is monkeypatched so no real call reaches the RAG backend.
"""
import uuid

import httpx

from app.models.curriculum import Subject, Chapter, Topic

FAKE_QUESTIONS = [
    {"prompt": "What is 2 + 2?", "options": ["3", "4", "5", "6"], "correctIndex": 1, "explanation": "2+2=4"},
    {"prompt": "What is the capital of France?", "options": ["Berlin", "Madrid", "Paris", "Rome"], "correctIndex": 2, "explanation": "Paris is the capital."},
]


class _FakeResponse:
    def __init__(self, questions):
        self._questions = questions

    def raise_for_status(self):
        pass

    def json(self):
        return {"questions": self._questions}


class _FakeAsyncClient:
    def __init__(self, *args, questions=None, **kwargs):
        self._questions = FAKE_QUESTIONS if questions is None else questions

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False

    async def post(self, url, json=None, headers=None):
        return _FakeResponse(self._questions)


def _mock_rag(monkeypatch, questions=None):
    def factory(*args, **kwargs):
        return _FakeAsyncClient(*args, questions=questions, **kwargs)
    monkeypatch.setattr(httpx, "AsyncClient", factory)


def signup_and_login(client, email="quiz-student@example.com", grade="CBSE-10"):
    client.post("/api/auth/signup", json={
        "name": "Quiz Student", "email": email, "password": "correct-horse-battery-staple", "grade": grade,
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


def test_start_topic_quiz_generates_and_persists_questions(client, db_session, monkeypatch):
    _mock_rag(monkeypatch)
    signup_and_login(client)
    _, _, topic = make_topic(db_session)

    res = client.post("/api/assessments/start", json={"topicId": topic.id, "count": 2})
    assert res.status_code == 200
    body = res.json()
    assert body["assessmentId"]
    assert len(body["questions"]) == 2
    for q in body["questions"]:
        assert "itemId" in q and "prompt" in q and "options" in q
        assert "correctIndex" not in q  # must never leak the answer


def test_start_assessment_requires_exactly_one_scope(client, db_session):
    signup_and_login(client, email="scope-check@example.com")
    res = client.post("/api/assessments/start", json={"count": 2})
    assert res.status_code == 422

    _, chapter, topic = make_topic(db_session)
    res = client.post("/api/assessments/start", json={"topicId": topic.id, "chapterId": chapter.id})
    assert res.status_code == 422


def test_start_assessment_no_content_returns_422(client, db_session, monkeypatch):
    _mock_rag(monkeypatch, questions=[])
    signup_and_login(client, email="no-content@example.com")
    _, _, topic = make_topic(db_session)

    res = client.post("/api/assessments/start", json={"topicId": topic.id, "count": 2})
    assert res.status_code == 422


def test_answer_then_finish_computes_score_and_updates_mastery(client, db_session, monkeypatch):
    from app.models.progress import Mastery

    _mock_rag(monkeypatch)
    signup_and_login(client, email="finish-flow@example.com")
    _, _, topic = make_topic(db_session)

    start = client.post("/api/assessments/start", json={"topicId": topic.id, "count": 2}).json()
    assessment_id = start["assessmentId"]
    items = start["questions"]

    # Answer both correctly (index 1 for Q1, index 2 for Q2, per FAKE_QUESTIONS).
    r1 = client.post(f"/api/assessments/{assessment_id}/answer", json={"itemId": items[0]["itemId"], "selectedIndex": 1})
    assert r1.status_code == 200
    assert r1.json()["isCorrect"] is True

    r2 = client.post(f"/api/assessments/{assessment_id}/answer", json={"itemId": items[1]["itemId"], "selectedIndex": 2})
    assert r2.json()["isCorrect"] is True

    finish = client.post(f"/api/assessments/{assessment_id}/finish")
    assert finish.status_code == 200
    body = finish.json()
    assert body["score"] == 100
    assert body["correctCount"] == 2

    mastery = db_session.query(Mastery).filter(Mastery.topicId == topic.id).first()
    assert mastery is not None
    assert mastery.value == 1


def test_finish_with_wrong_answers_gives_low_score_and_no_mastery_bump(client, db_session, monkeypatch):
    from app.models.progress import Mastery

    _mock_rag(monkeypatch)
    signup_and_login(client, email="low-score@example.com")
    _, _, topic = make_topic(db_session)

    start = client.post("/api/assessments/start", json={"topicId": topic.id, "count": 2}).json()
    assessment_id = start["assessmentId"]
    items = start["questions"]

    client.post(f"/api/assessments/{assessment_id}/answer", json={"itemId": items[0]["itemId"], "selectedIndex": 0})
    client.post(f"/api/assessments/{assessment_id}/answer", json={"itemId": items[1]["itemId"], "selectedIndex": 0})

    finish = client.post(f"/api/assessments/{assessment_id}/finish")
    assert finish.json()["score"] == 0

    mastery = db_session.query(Mastery).filter(Mastery.topicId == topic.id).first()
    assert mastery is None


def test_cannot_answer_or_refinish_a_completed_assessment(client, db_session, monkeypatch):
    _mock_rag(monkeypatch)
    signup_and_login(client, email="double-finish@example.com")
    _, _, topic = make_topic(db_session)

    start = client.post("/api/assessments/start", json={"topicId": topic.id, "count": 1}).json()
    assessment_id = start["assessmentId"]
    item_id = start["questions"][0]["itemId"]

    client.post(f"/api/assessments/{assessment_id}/answer", json={"itemId": item_id, "selectedIndex": 0})
    client.post(f"/api/assessments/{assessment_id}/finish")

    res = client.post(f"/api/assessments/{assessment_id}/finish")
    assert res.status_code == 400

    res = client.post(f"/api/assessments/{assessment_id}/answer", json={"itemId": item_id, "selectedIndex": 1})
    assert res.status_code == 400


def test_assessment_history_lists_completed_only(client, db_session, monkeypatch):
    _mock_rag(monkeypatch)
    signup_and_login(client, email="history-check@example.com")
    _, _, topic = make_topic(db_session)

    start = client.post("/api/assessments/start", json={"topicId": topic.id, "count": 1}).json()
    assessment_id = start["assessmentId"]
    item_id = start["questions"][0]["itemId"]

    # In-progress assessment shouldn't show up yet.
    assert client.get("/api/assessments/history").json()["assessments"] == []

    client.post(f"/api/assessments/{assessment_id}/answer", json={"itemId": item_id, "selectedIndex": 1})
    client.post(f"/api/assessments/{assessment_id}/finish")

    history = client.get("/api/assessments/history").json()["assessments"]
    assert len(history) == 1
    assert history[0]["label"] == "Uniform Motion"
    assert history[0]["score"] == 100
