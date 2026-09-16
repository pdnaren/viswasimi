import uuid
import logging
import razorpay
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, Request

from sqlalchemy.orm import Session as DBSession
from app.api.dependencies import get_db, get_current_user, _to_naive_utc, now_utc
from app.core.config import settings
from app.core.rate_limit import limiter
from app.models.user import User
from app.models.billing import SubscriptionPlan, UserSubscription
from app.schemas.billing import UpgradeRequest, PaymentVerifyRequest

logger = logging.getLogger(__name__)
router = APIRouter()

# Only initialize the client if the keys are actually present
rzp_client = None
if settings.RAZORPAY_KEY_ID and settings.RAZORPAY_KEY_SECRET:
    rzp_client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))

@router.post("/create-order")
@limiter.limit("10/minute")
async def create_order(
    request: Request,
    payload: UpgradeRequest,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    amount = 29900 if payload.planName.lower() == "basic" else 0
    if amount == 0:
        raise HTTPException(status_code=400, detail="Invalid plan")

    if not rzp_client:
        raise HTTPException(status_code=500, detail="Payment gateway not configured")

    try:
        data = {"amount": amount, "currency": "INR", "receipt": f"rcpt_{user.id[:8]}"}
        order = rzp_client.order.create(data=data)
        return {"order_id": order["id"], "amount": amount, "key_id": settings.RAZORPAY_KEY_ID}
    except Exception as e:
        logger.error(f"Razorpay Order Error: {e}")
        raise HTTPException(status_code=500, detail="Could not create payment order.")

@router.post("/verify")
async def verify_payment(
    payload: PaymentVerifyRequest,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    if not rzp_client:
        raise HTTPException(status_code=500, detail="Payment gateway not configured")

    try:
        rzp_client.utility.verify_payment_signature({
            "razorpay_order_id":   payload.razorpay_order_id,
            "razorpay_payment_id": payload.razorpay_payment_id,
            "razorpay_signature":  payload.razorpay_signature,
        })
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid payment signature")

    target_plan = payload.planName.lower().strip()
    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.name == target_plan).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    start_dt = _to_naive_utc(now_utc())
    end_dt = start_dt + timedelta(days=30) if target_plan != "free" else None

    db.query(UserSubscription).filter(UserSubscription.userId == user.id).update({"isActive": False})
    new_sub = UserSubscription(
        id=f"sub_{uuid.uuid4().hex}",
        userId=user.id,
        planId=plan.id,
        isActive=True,
        startsAt=start_dt,
        endsAt=end_dt,
    )
    db.add(new_sub)
    db.commit()
    return {"ok": True}

@router.post("/cancel-subscription")
def cancel_subscription(
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    free_plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.name == "free").first()
    if not free_plan:
        raise HTTPException(status_code=500, detail="Free plan not found in database.")

    db.query(UserSubscription).filter(
        UserSubscription.userId == user.id,
        UserSubscription.isActive.is_(True),
    ).update({"isActive": False})

    new_sub = UserSubscription(
        id=f"sub_{uuid.uuid4().hex}",
        userId=user.id,
        planId=free_plan.id,
        isActive=True,
        startsAt=_to_naive_utc(now_utc()),
        endsAt=None,
    )
    db.add(new_sub)
    db.commit()
    return {"ok": True, "message": "Subscription cancelled."}