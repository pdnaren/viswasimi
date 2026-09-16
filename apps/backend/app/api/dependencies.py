from datetime import datetime, timedelta, timezone
from typing import Generator
from fastapi import Cookie, Depends, HTTPException, Request

from sqlalchemy.orm import Session as DBSession
from app.core.config import settings
from app.db.session import SessionLocal
from app.models.auth import Session
from app.models.user import User
from app.models.billing import UserSubscription, SubscriptionPlan

# ── IST timezone ──
IST = timezone(timedelta(hours=5, minutes=30))

def now_utc() -> datetime:
    return datetime.now(timezone.utc)

def _to_naive_utc(dt: datetime) -> datetime:
    return dt.astimezone(timezone.utc).replace(tzinfo=None)

def to_ist_str(dt: datetime | None) -> str | None:
    if not dt:
        return None
    utc_dt = dt.replace(tzinfo=timezone.utc)
    return utc_dt.astimezone(IST).isoformat()

def get_db() -> Generator:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def cookie_settings() -> dict:
    return {
        "httponly": True,
        "secure": settings.COOKIE_SECURE,
        "samesite": "none" if settings.COOKIE_SECURE else "strict",
        "path": "/",
        "max_age": 60 * 60 * 24 * settings.SESSION_DAYS,
    }

def get_current_user(
    request: Request,
    viswasimi_session: str | None = Cookie(default=None),
    db: DBSession = Depends(get_db)
) -> User:
    """Dependency to enforce authentication and retrieve the current user."""
    token = viswasimi_session or request.headers.get("authorization", "").replace("Bearer ", "").strip()
    if not token:
        raise HTTPException(401, "Unauthorized")
        
    sess = db.query(Session).filter(
        Session.token == token, 
        Session.expiresAt > _to_naive_utc(now_utc())
    ).first()
    
    if not sess: 
        raise HTTPException(401, "Unauthorized")
        
    user = db.query(User).filter(User.id == sess.userId).first()
    if not user: 
        raise HTTPException(401, "Unauthorized")
        
    return user

def get_active_subscription(user_id: str, db: DBSession) -> UserSubscription | None:
    return (
        db.query(UserSubscription)
        .join(SubscriptionPlan, SubscriptionPlan.id == UserSubscription.planId)
        .filter(UserSubscription.userId == user_id, UserSubscription.isActive.is_(True))
        .order_by(UserSubscription.startsAt.desc())
        .first()
    )