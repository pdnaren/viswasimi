"""
Regression coverage for the student/subscription/usage admin routes added
to app/api/routes/admin.py (PRD §39 Admin Portal), which previously only
covered curriculum and document management.
"""
from app.models.user import User


def make_admin(client, db_session, email="admin@example.com"):
    client.post("/api/auth/signup", json={
        "name": "Admin User", "email": email, "password": "correct-horse-battery-staple", "grade": "CBSE-10",
    })
    db_session.query(User).filter(User.email == email).update({"role": "ADMIN"})
    db_session.flush()


def make_student(client, email="student@example.com", name="Some Student"):
    client.post("/api/auth/signup", json={
        "name": name, "email": email, "password": "correct-horse-battery-staple", "grade": "CBSE-9",
    })


def test_non_admin_gets_403(client):
    make_student(client)
    res = client.get("/api/admin/users")
    assert res.status_code == 403


def test_list_users_returns_plan_and_supports_search(client, db_session):
    make_admin(client, db_session)
    make_student(client, email="alice@example.com", name="Alice Wonderland")

    res = client.get("/api/admin/users")
    assert res.status_code == 200
    body = res.json()
    assert body["total"] >= 2
    alice = next(u for u in body["users"] if u["email"] == "alice@example.com")
    assert alice["planName"] == "free"

    res = client.get("/api/admin/users", params={"search": "wonderland"})
    assert res.json()["total"] == 1
    assert res.json()["users"][0]["email"] == "alice@example.com"


def test_user_detail_includes_stats_and_subscription(client, db_session):
    make_admin(client, db_session)
    make_student(client, email="bob@example.com", name="Bob")
    bob = db_session.query(User).filter(User.email == "bob@example.com").one()

    res = client.get(f"/api/admin/users/{bob.id}")
    assert res.status_code == 200
    body = res.json()
    assert body["user"]["email"] == "bob@example.com"
    assert body["subscription"]["planName"] == "free"
    assert body["stats"]["chatMessages"] == 0
    assert body["recentAssessments"] == []


def test_user_detail_404_for_unknown_user(client, db_session):
    make_admin(client, db_session)
    res = client.get("/api/admin/users/does-not-exist")
    assert res.status_code == 404


def test_override_subscription_changes_active_plan(client, db_session):
    from app.models.billing import SubscriptionPlan, UserSubscription
    import uuid

    make_admin(client, db_session)
    make_student(client, email="carol@example.com")
    carol = db_session.query(User).filter(User.email == "carol@example.com").one()

    basic_plan = db_session.query(SubscriptionPlan).filter(SubscriptionPlan.name == "basic").first()
    if not basic_plan:
        basic_plan = SubscriptionPlan(id=f"plan_{uuid.uuid4().hex}", name="basic", price=299, isActive=True)
        db_session.add(basic_plan)
        db_session.flush()

    res = client.post(f"/api/admin/users/{carol.id}/subscription", json={"planName": "basic", "days": 30})
    assert res.status_code == 200
    assert res.json()["planName"] == "basic"

    active_subs = (
        db_session.query(UserSubscription)
        .filter(UserSubscription.userId == carol.id, UserSubscription.isActive.is_(True))
        .all()
    )
    assert len(active_subs) == 1
    assert active_subs[0].planId == basic_plan.id


def test_override_subscription_unknown_plan_returns_404(client, db_session):
    make_admin(client, db_session)
    make_student(client, email="dave@example.com")
    dave = db_session.query(User).filter(User.email == "dave@example.com").one()

    res = client.post(f"/api/admin/users/{dave.id}/subscription", json={"planName": "nonexistent-plan"})
    assert res.status_code == 404


def test_usage_summary_reflects_users_and_plans(client, db_session):
    make_admin(client, db_session)
    make_student(client, email="erin@example.com")

    res = client.get("/api/admin/usage/summary")
    assert res.status_code == 200
    body = res.json()
    assert body["totalUsers"] >= 2
    plan_names = {p["planName"] for p in body["activeSubscriptionsByPlan"]}
    assert "free" in plan_names
    assert body["totalAssessmentsCompleted"] == 0
    assert body["averageAssessmentScore"] is None
