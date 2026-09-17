"""
Regression coverage for app/api/routes/auth.py.

test_forgot_password_hides_reset_link_in_production and
test_forgot_password_dev_preview_includes_reset_link guard the fix for a
real vulnerability: forgot-password used to echo the live reset token/link
back to any anonymous caller whenever SMTP wasn't configured, which is an
account-takeover hole on any deployment that forgets to set SMTP_* env
vars. It's now gated behind ENVIRONMENT != "production".

The test_google_* tests cover the "Continue with Google" flow added
alongside nullable passwordHash / User.googleId. httpx.post/get are
monkeypatched so no real network call reaches Google.
"""
import httpx

from app.core.config import settings


def signup_payload(email="student@example.com", **overrides):
    payload = {
        "name": "Test Student",
        "email": email,
        "password": "correct-horse-battery-staple",
        "grade": "CBSE-10",
    }
    payload.update(overrides)
    return payload


def test_signup_creates_user_with_free_subscription(client, db_session):
    from app.models.user import User
    from app.models.billing import UserSubscription, SubscriptionPlan

    res = client.post("/api/auth/signup", json=signup_payload())
    assert res.status_code == 201
    body = res.json()
    assert body["user"]["email"] == "student@example.com"
    assert body["sessionToken"]
    assert "viswasimi_session" in res.cookies

    user = db_session.query(User).filter(User.email == "student@example.com").one()
    sub = (
        db_session.query(UserSubscription)
        .join(SubscriptionPlan)
        .filter(UserSubscription.userId == user.id, UserSubscription.isActive.is_(True))
        .one()
    )
    assert sub.plan.name == "free"


def test_signup_duplicate_email_returns_409(client):
    client.post("/api/auth/signup", json=signup_payload(email="dupe@example.com"))
    res = client.post("/api/auth/signup", json=signup_payload(email="dupe@example.com"))
    assert res.status_code == 409


def test_login_success_returns_session(client):
    client.post("/api/auth/signup", json=signup_payload(email="login-ok@example.com"))
    res = client.post("/api/auth/login", json={"email": "login-ok@example.com", "password": "correct-horse-battery-staple"})
    assert res.status_code == 200
    assert res.json()["sessionToken"]
    assert "viswasimi_session" in res.cookies


def test_login_wrong_password_returns_401(client):
    client.post("/api/auth/signup", json=signup_payload(email="login-bad@example.com"))
    res = client.post("/api/auth/login", json={"email": "login-bad@example.com", "password": "wrong-password"})
    assert res.status_code == 401


def test_forgot_password_unknown_email_gives_generic_message(client):
    res = client.post("/api/auth/forgot-password", json={"email": "nobody@example.com"})
    assert res.status_code == 200
    body = res.json()
    assert "resetLink" not in body
    assert "resetToken" not in body


def test_forgot_password_dev_preview_includes_reset_link(client, monkeypatch):
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    monkeypatch.setattr(settings, "SMTP_HOST", None)
    client.post("/api/auth/signup", json=signup_payload(email="forgot-dev@example.com"))

    res = client.post("/api/auth/forgot-password", json={"email": "forgot-dev@example.com"})
    assert res.status_code == 200
    body = res.json()
    assert body.get("resetToken")
    assert "/reset-password?token=" in body.get("resetLink", "")


def test_forgot_password_hides_reset_link_in_production(client, monkeypatch):
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(settings, "SMTP_HOST", None)
    client.post("/api/auth/signup", json=signup_payload(email="forgot-prod@example.com"))

    res = client.post("/api/auth/forgot-password", json={"email": "forgot-prod@example.com"})
    assert res.status_code == 200
    body = res.json()
    assert "resetToken" not in body
    assert "resetLink" not in body


def _configure_google(monkeypatch):
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "test-client-id")
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_SECRET", "test-client-secret")
    monkeypatch.setattr(settings, "GOOGLE_REDIRECT_URI", "http://backend.test/api/auth/google/callback")


def _fake_google_exchange(monkeypatch, *, email="google-student@example.com", sub="google-sub-1", verified=True):
    def fake_post(url, **kwargs):
        assert url == "https://oauth2.googleapis.com/token"
        return httpx.Response(200, json={"access_token": "fake-access-token"})

    def fake_get(url, **kwargs):
        assert url == "https://www.googleapis.com/oauth2/v3/userinfo"
        return httpx.Response(200, json={"sub": sub, "email": email, "email_verified": verified, "name": "Google Student"})

    monkeypatch.setattr(httpx, "post", fake_post)
    monkeypatch.setattr(httpx, "get", fake_get)


def _start_google_login(client) -> str:
    res = client.get("/api/auth/google/login", follow_redirects=False)
    assert res.status_code in (302, 307)
    return client.cookies["google_oauth_state"]


def test_google_login_returns_501_when_not_configured(client, monkeypatch):
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", None)
    res = client.get("/api/auth/google/login", follow_redirects=False)
    assert res.status_code == 501


def test_google_login_redirects_with_state_cookie(client, monkeypatch):
    _configure_google(monkeypatch)
    res = client.get("/api/auth/google/login", follow_redirects=False)
    assert res.status_code in (302, 307)
    assert res.headers["location"].startswith("https://accounts.google.com/o/oauth2/v2/auth?")
    assert "google_oauth_state" in res.cookies


def test_google_callback_rejects_state_mismatch(client, monkeypatch):
    _configure_google(monkeypatch)
    _start_google_login(client)
    res = client.get("/api/auth/google/callback", params={"code": "abc", "state": "wrong"}, follow_redirects=False)
    assert res.status_code in (302, 307)
    assert "error=google_state_mismatch" in res.headers["location"]


def test_google_callback_new_user_redirects_to_signup_with_pending_token(client, monkeypatch):
    _configure_google(monkeypatch)
    _fake_google_exchange(monkeypatch, email="new-google-user@example.com")
    state = _start_google_login(client)

    res = client.get("/api/auth/google/callback", params={"code": "abc", "state": state}, follow_redirects=False)
    assert res.status_code in (302, 307)
    location = res.headers["location"]
    assert location.startswith("http://localhost:3000/signup?")
    assert "google_pending=" in location


def test_google_callback_existing_user_logs_in(client, db_session, monkeypatch):
    from app.models.user import User

    client.post("/api/auth/signup", json=signup_payload(email="linked-google@example.com"))
    user = db_session.query(User).filter(User.email == "linked-google@example.com").one()
    assert user.googleId is None

    _configure_google(monkeypatch)
    _fake_google_exchange(monkeypatch, email="linked-google@example.com", sub="google-sub-existing")
    state = _start_google_login(client)

    res = client.get("/api/auth/google/callback", params={"code": "abc", "state": state}, follow_redirects=False)
    assert res.status_code in (302, 307)
    location = res.headers["location"]
    assert location.startswith("http://localhost:3000/auth/callback?token=")

    db_session.refresh(user)
    assert user.googleId == "google-sub-existing"


def test_google_complete_signup_creates_user_with_free_subscription(client, db_session):
    from app.core.security import sign_payload
    from app.models.user import User
    from app.models.billing import UserSubscription, SubscriptionPlan

    token = sign_payload({"sub": "google-sub-2", "email": "complete-signup@example.com", "name": "New Student"})
    res = client.post(
        "/api/auth/google/complete-signup",
        json={"token": token, "name": "New Student", "grade": "CBSE-9"},
    )
    assert res.status_code == 201
    body = res.json()
    assert body["user"]["email"] == "complete-signup@example.com"
    assert body["sessionToken"]

    user = db_session.query(User).filter(User.email == "complete-signup@example.com").one()
    assert user.googleId == "google-sub-2"
    assert user.passwordHash is None
    sub = (
        db_session.query(UserSubscription)
        .join(SubscriptionPlan)
        .filter(UserSubscription.userId == user.id, UserSubscription.isActive.is_(True))
        .one()
    )
    assert sub.plan.name == "free"


def test_google_complete_signup_rejects_invalid_token(client):
    res = client.post(
        "/api/auth/google/complete-signup",
        json={"token": "not-a-real-token", "name": "New Student", "grade": "CBSE-9"},
    )
    assert res.status_code == 400


def test_login_rejects_google_only_account_without_crashing(client, db_session):
    from app.core.security import sign_payload

    token = sign_payload({"sub": "google-sub-3", "email": "google-only@example.com", "name": "Google Only"})
    client.post(
        "/api/auth/google/complete-signup",
        json={"token": token, "name": "Google Only", "grade": "CBSE-9"},
    )

    res = client.post("/api/auth/login", json={"email": "google-only@example.com", "password": "whatever123"})
    assert res.status_code == 401
