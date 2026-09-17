"""
Regression coverage for POST /api/chat/homework (Homework Mode, PRD §30),
which previously didn't exist. openai_client.chat.completions.create is
monkeypatched so no real call reaches OpenAI.
"""
import io

from app.api.routes import chat as chat_module

# The route only checks the declared content-type / size, never decodes the
# image, so any bytes stand in for a real photo here.
FAKE_IMAGE_BYTES = b"not-a-real-png-but-the-route-never-decodes-it"


def _mock_openai_answer(monkeypatch, answer="Here's a hint: think about the units."):
    class _FakeMessage:
        def __init__(self, content):
            self.content = content

    class _FakeChoice:
        def __init__(self, content):
            self.message = _FakeMessage(content)

    class _FakeCompletion:
        def __init__(self, content):
            self.choices = [_FakeChoice(content)]

    async def fake_create(*args, **kwargs):
        return _FakeCompletion(answer)

    monkeypatch.setattr(chat_module.openai_client.chat.completions, "create", fake_create)


def signup_and_login(client, email="homework-student@example.com"):
    client.post("/api/auth/signup", json={
        "name": "Homework Student", "email": email, "password": "correct-horse-battery-staple", "grade": "CBSE-9",
    })


def test_homework_requires_auth(client):
    res = client.post(
        "/api/chat/homework",
        files={"image": ("q.png", io.BytesIO(FAKE_IMAGE_BYTES), "image/png")},
    )
    assert res.status_code == 401


def test_homework_rejects_non_image_upload(client):
    signup_and_login(client)
    res = client.post(
        "/api/chat/homework",
        files={"image": ("q.pdf", io.BytesIO(b"%PDF-1.4"), "application/pdf")},
    )
    assert res.status_code == 400
    assert "PDF" in res.json()["detail"]


def test_homework_returns_hint_by_default(client, monkeypatch):
    _mock_openai_answer(monkeypatch, answer="Think about which formula applies here.")
    signup_and_login(client, email="hint-default@example.com")

    res = client.post(
        "/api/chat/homework",
        files={"image": ("q.png", io.BytesIO(FAKE_IMAGE_BYTES), "image/png")},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["assistanceLevel"] == "hint"
    assert "formula" in body["answer"]


def test_homework_invalid_assistance_level_falls_back_to_hint(client, monkeypatch):
    _mock_openai_answer(monkeypatch)
    signup_and_login(client, email="invalid-level@example.com")

    res = client.post(
        "/api/chat/homework",
        files={"image": ("q.png", io.BytesIO(FAKE_IMAGE_BYTES), "image/png")},
        data={"assistanceLevel": "give-me-everything"},
    )
    assert res.status_code == 200
    assert res.json()["assistanceLevel"] == "hint"


def test_homework_accepts_solution_level(client, monkeypatch):
    _mock_openai_answer(monkeypatch, answer="The final answer is 42.")
    signup_and_login(client, email="solution-level@example.com")

    res = client.post(
        "/api/chat/homework",
        files={"image": ("q.png", io.BytesIO(FAKE_IMAGE_BYTES), "image/png")},
        data={"assistanceLevel": "solution", "question": "What is the answer to question 3?"},
    )
    assert res.status_code == 200
    assert res.json()["assistanceLevel"] == "solution"
    assert "42" in res.json()["answer"]


def test_homework_openai_failure_returns_502(client, monkeypatch):
    async def failing_create(*args, **kwargs):
        raise RuntimeError("openai down")
    monkeypatch.setattr(chat_module.openai_client.chat.completions, "create", failing_create)
    signup_and_login(client, email="homework-llm-down@example.com")

    res = client.post(
        "/api/chat/homework",
        files={"image": ("q.png", io.BytesIO(FAKE_IMAGE_BYTES), "image/png")},
    )
    assert res.status_code == 502
