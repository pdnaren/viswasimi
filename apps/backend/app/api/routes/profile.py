from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session as DBSession

from app.api.dependencies import get_db, get_current_user, get_active_subscription
from app.models.user import User
from app.schemas.user import UpdateLocaleRequest

router = APIRouter()

def _serialize_user(user: User) -> dict:
    return {
        "id":        user.id,
        "name":      user.name,
        "email":     user.email,
        "grade":     user.grade,
        "role":      user.role,
        "locale":    user.locale,
        "timezone":  user.timezone,
        "createdAt": user.createdAt.isoformat() if user.createdAt else None,
    }

@router.post("/locale")
def update_locale(
    payload: UpdateLocaleRequest,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    user.locale = payload.locale
    db.commit()
    return {"ok": True, "locale": user.locale}

@router.get("/me")
def profile_me(
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    subscription = get_active_subscription(user.id, db)
    return {
        "user": _serialize_user(user),
        "subscription": {
            "planName":  subscription.plan.name if subscription and subscription.plan else "free",
            "isActive":  subscription.isActive if subscription else True,
            "startsAt":  subscription.startsAt.isoformat() if subscription and subscription.startsAt else None,
            "endsAt":    subscription.endsAt.isoformat() if subscription and subscription.endsAt else None,
        },
    }