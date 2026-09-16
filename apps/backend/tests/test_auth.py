"""
Regression coverage for app/api/routes/auth.py.

test_forgot_password_hides_reset_link_in_production and
test_forgot_password_dev_preview_includes_reset_link guard the fix for a
real vulnerability: forgot-password used to echo the live reset token/link
back to any anonymous caller whenever SMTP wasn't configured, which is an
account-takeover hole on any deployment that forgets to set SMTP_* env
vars. It's now gated behind ENVIRONMENT != "production".
"""
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
