import os
import uuid
import secrets
import bcrypt
import smtplib
from datetime import timedelta
from email.message import EmailMessage

from fastapi import APIRouter, Depends, Request, Response, Cookie, HTTPException
from sqlalchemy.orm import Session as DBSession

from app.api.dependencies import (
    get_db, get_current_user, cookie_settings, now_utc, _to_naive_utc
)
from app.core.rate_limit import limiter
from app.models.user import User
from app.models.auth import Session, PasswordResetToken
from app.models.billing import SubscriptionPlan, UserSubscription
from app.schemas.auth import (
    SignupRequest, LoginRequest, ChangePasswordRequest, 
    ForgotPasswordRequest, ResetPasswordRequest
)

router = APIRouter()

# ─────────────────────────────────────────────────────────────────────────────
# Utilities
# ─────────────────────────────────────────────────────────────────────────────

def smtp_is_configured() -> bool:
    return bool(os.getenv("SMTP_HOST") and os.getenv("SMTP_USER") and os.getenv("SMTP_PASS"))

def send_email_task(to_email: str, subject: str, html: str):
    host, port = os.getenv("SMTP_HOST"), int(os.getenv("SMTP_PORT", "587"))
    user, password = os.getenv("SMTP_USER"), os.getenv("SMTP_PASS")
    if not all([host, user, password]): return
    msg = EmailMessage()
    msg["From"] = f"Viswasimi <{user}>"
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.add_alternative(html, subtype="html")
    with smtplib.SMTP(host, port) as server:
        server.starttls()
        server.login(user, password)
        server.send_message(msg)

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

def _create_session(db: DBSession, user_id: str) -> Session:
    session_days = int(os.getenv("SESSION_DAYS", "7"))
    session = Session(
        id=f"sess_{uuid.uuid4().hex}",
        userId=user_id,
        token=secrets.token_hex(32),
        createdAt=_to_naive_utc(now_utc()),
        expiresAt=_to_naive_utc(now_utc() + timedelta(days=session_days)),
    )
    db.add(session)
    db.flush()
    return session

def valid_reset_token(db: DBSession, token: str) -> PasswordResetToken | None:
    token_row = db.query(PasswordResetToken).filter(PasswordResetToken.token == token).first()
    if not token_row:
        return None
    if token_row.usedAt or token_row.expiresAt < _to_naive_utc(now_utc()):
        return None
    return token_row

# ─────────────────────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/me")
def me(
    request: Request,
    viswasimi_session: str | None = Cookie(default=None),
    db: DBSession = Depends(get_db),
):
    user = get_current_user(request, viswasimi_session, db)
    # Re-fetch session to get the token for the response payload
    token = viswasimi_session or request.headers.get("authorization", "").replace("Bearer ", "").strip()
    return {"user": _serialize_user(user), "sessionToken": token}

@router.post("/signup", status_code=201)
@limiter.limit("5/minute")
def signup(
    request: Request,
    payload: SignupRequest,
    response: Response,
    db: DBSession = Depends(get_db),
):
    email = payload.email.lower().strip()

    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    user = User(
        id=f"user_{uuid.uuid4().hex}",
        role="STUDENT",
        grade=payload.grade.strip().upper(),
        name=payload.name.strip(),
        email=email,
        passwordHash=bcrypt.hashpw(payload.password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8"),
        locale=os.getenv("DEFAULT_LOCALE", "en-IN"),
        timezone=os.getenv("DEFAULT_TIMEZONE", "Asia/Kolkata"),
        createdAt=_to_naive_utc(now_utc()),
    )
    db.add(user)
    db.flush()

    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.name == "free").first()
    if not plan:
        plan = SubscriptionPlan(id=f"plan_{uuid.uuid4().hex}", name="free", price=None, isActive=True)
        db.add(plan)
        db.flush()

    db.add(
        UserSubscription(
            id=f"py_{uuid.uuid4().hex}",
            userId=user.id,
            planId=plan.id,
            startsAt=_to_naive_utc(now_utc()),
            endsAt=None,
            isActive=True,
        )
    )

    session = _create_session(db, user.id)
    db.commit()
    response.set_cookie("viswasimi_session", session.token, **cookie_settings())

    return {"user": _serialize_user(user), "sessionToken": session.token}

@router.post("/login")
@limiter.limit("10/minute")
def login(
    request: Request,
    payload: LoginRequest,
    response: Response,
    db: DBSession = Depends(get_db),
):
    user = db.query(User).filter(User.email == payload.email.lower().strip()).first()
    if not user or not bcrypt.checkpw(payload.password.encode("utf-8"), user.passwordHash.encode("utf-8")):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    db.query(PasswordResetToken).filter(
        PasswordResetToken.userId == user.id,
        PasswordResetToken.usedAt.is_(None),
    ).update({"usedAt": _to_naive_utc(now_utc())})

    session = _create_session(db, user.id)
    db.commit()
    response.set_cookie("viswasimi_session", session.token, **cookie_settings())

    return {"ok": True, "user": _serialize_user(user), "sessionToken": session.token}

@router.get("/logout")
def logout(
    request: Request,
    response: Response,
    viswasimi_session: str | None = Cookie(default=None),
    db: DBSession = Depends(get_db),
):
    token = viswasimi_session or request.headers.get("authorization", "").replace("Bearer ", "").strip()
    session = db.query(Session).filter(Session.token == token).first()
    if session:
        db.delete(session)
        db.commit()
    response.delete_cookie("viswasimi_session", path="/")
    return {"ok": True}

@router.post("/change-password")
@limiter.limit("5/minute")
def change_password(
    request: Request,
    payload: ChangePasswordRequest,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    if not bcrypt.checkpw(payload.currentPassword.encode("utf-8"), user.passwordHash.encode("utf-8")):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    user.passwordHash = bcrypt.hashpw(payload.newPassword.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    db.commit()
    return {"ok": True, "message": "Password updated"}

@router.post("/forgot-password")
@limiter.limit("3/minute")
def forgot_password(
    request: Request,
    payload: ForgotPasswordRequest,
    db: DBSession = Depends(get_db),
):
    user = db.query(User).filter(User.email == payload.email.lower().strip()).first()
    message = {"message": "If this email exists, a reset link has been sent"}
    if not user:
        return message

    token = secrets.token_hex(32)
    db.add(
        PasswordResetToken(
            id=f"py_{uuid.uuid4().hex}",
            userId=user.id,
            token=token,
            createdAt=_to_naive_utc(now_utc()),
            expiresAt=_to_naive_utc(now_utc() + timedelta(minutes=30)),
            usedAt=None,
        )
    )
    db.commit()

    reset_link = f"{os.getenv('APP_URL', 'http://localhost:3000')}/reset-password?token={token}"
    if smtp_is_configured():
        send_email_task(
            to_email=user.email,
            subject="Reset your Viswasimi password",
            html=(
                f"<p>Hi {user.name},</p>"
                "<p>You requested a password reset for your Viswasimi account.</p>"
                "<p>Click the link below to reset your password (valid for 30 minutes):</p>"
                f'<p><a href="{reset_link}">{reset_link}</a></p>'
                "<p>If you didn't request this, you can safely ignore this email.</p>"
            ),
        )
        return message

    return {**message, "delivery": "preview", "resetLink": reset_link, "resetToken": token}

@router.get("/reset-password/validate")
def validate_reset_password(token: str, db: DBSession = Depends(get_db)):
    if not valid_reset_token(db, token):
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    return {"ok": True}

@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest, db: DBSession = Depends(get_db)):
    token_row = valid_reset_token(db, payload.token)
    if not token_row:
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    
    user = db.query(User).filter(User.id == token_row.userId).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid token")
        
    user.passwordHash = bcrypt.hashpw(payload.password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    token_row.usedAt = _to_naive_utc(now_utc())
    db.commit()
    return {"message": "Password reset successful"}