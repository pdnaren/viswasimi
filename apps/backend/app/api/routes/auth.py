import uuid
import secrets
import bcrypt
import smtplib
import logging
from datetime import timedelta
from email.message import EmailMessage
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, Request, Response, Cookie, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session as DBSession

from app.api.dependencies import (
    get_db, get_current_user, cookie_settings, now_utc, _to_naive_utc
)
from app.core.config import settings
from app.core.rate_limit import limiter
from app.core.security import sign_payload, verify_payload
from app.models.user import User
from app.models.auth import Session, PasswordResetToken
from app.models.billing import SubscriptionPlan, UserSubscription
from app.schemas.auth import (
    SignupRequest, LoginRequest, ChangePasswordRequest,
    ForgotPasswordRequest, ResetPasswordRequest, GoogleCompleteSignupRequest
)

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"

logger = logging.getLogger(__name__)
router = APIRouter()

# ─────────────────────────────────────────────────────────────────────────────
# Utilities
# ─────────────────────────────────────────────────────────────────────────────

def smtp_is_configured() -> bool:
    return bool(settings.SMTP_HOST and settings.SMTP_USER and settings.SMTP_PASS)

def send_email_task(to_email: str, subject: str, html: str):
    host, port = settings.SMTP_HOST, settings.SMTP_PORT
    user, password = settings.SMTP_USER, settings.SMTP_PASS
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
    session = Session(
        id=f"sess_{uuid.uuid4().hex}",
        userId=user_id,
        token=secrets.token_hex(32),
        createdAt=_to_naive_utc(now_utc()),
        expiresAt=_to_naive_utc(now_utc() + timedelta(days=settings.SESSION_DAYS)),
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

def _attach_free_subscription(db: DBSession, user_id: str) -> None:
    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.name == "free").first()
    if not plan:
        plan = SubscriptionPlan(id=f"plan_{uuid.uuid4().hex}", name="free", price=None, isActive=True)
        db.add(plan)
        db.flush()

    db.add(
        UserSubscription(
            id=f"py_{uuid.uuid4().hex}",
            userId=user_id,
            planId=plan.id,
            startsAt=_to_naive_utc(now_utc()),
            endsAt=None,
            isActive=True,
        )
    )

def google_oauth_configured() -> bool:
    return bool(settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET and settings.GOOGLE_REDIRECT_URI)

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
        locale=settings.DEFAULT_LOCALE,
        timezone=settings.DEFAULT_TIMEZONE,
        createdAt=_to_naive_utc(now_utc()),
    )
    db.add(user)
    db.flush()
    _attach_free_subscription(db, user.id)

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
    if not user or not user.passwordHash:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not bcrypt.checkpw(payload.password.encode("utf-8"), user.passwordHash.encode("utf-8")):
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
    if not user.passwordHash or not bcrypt.checkpw(payload.currentPassword.encode("utf-8"), user.passwordHash.encode("utf-8")):
        if not user.passwordHash:
            raise HTTPException(
                status_code=400,
                detail="This account doesn't have a password yet. Use 'Forgot password' to set one.",
            )
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

    reset_link = f"{settings.APP_URL}/reset-password?token={token}"
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

    # SMTP isn't configured. Never echo the live reset token/link back to the
    # caller in a real deployment — this endpoint is unauthenticated, so doing
    # so would let anyone take over any account just by knowing its email.
    # Only expose it as a local-dev convenience.
    if settings.ENVIRONMENT != "production":
        return {**message, "delivery": "preview", "resetLink": reset_link, "resetToken": token}

    logger.error("Password reset requested but SMTP is not configured; email not sent for user %s", user.id)
    return message

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

# ─────────────────────────────────────────────────────────────────────────────
# Google OAuth ("Continue with Google")
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/google/login")
@limiter.limit("20/minute")
def google_login(request: Request):
    if not google_oauth_configured():
        raise HTTPException(status_code=501, detail="Google sign-in is not configured on this server")

    state = secrets.token_urlsafe(24)
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "online",
        "prompt": "select_account",
    }
    redirect = RedirectResponse(f"{GOOGLE_AUTH_URL}?{urlencode(params)}")
    # Lax (not Strict) because this cookie must survive the top-level
    # redirect back from accounts.google.com to our own /callback route.
    redirect.set_cookie(
        "google_oauth_state", state,
        httponly=True, secure=settings.COOKIE_SECURE, samesite="lax",
        max_age=600, path="/api/auth/google",
    )
    return redirect

@router.get("/google/callback")
def google_callback(
    request: Request,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    google_oauth_state: str | None = Cookie(default=None),
    db: DBSession = Depends(get_db),
):
    def denied(reason: str) -> RedirectResponse:
        redirect = RedirectResponse(f"{settings.APP_URL}/login?error={reason}")
        redirect.delete_cookie("google_oauth_state", path="/api/auth/google")
        return redirect

    if not google_oauth_configured():
        return denied("google_not_configured")
    if error or not code:
        return denied("google_denied")
    if not state or not google_oauth_state or not secrets.compare_digest(state, google_oauth_state):
        return denied("google_state_mismatch")

    try:
        token_res = httpx.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": settings.GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
            timeout=10.0,
        )
        token_res.raise_for_status()
        access_token = token_res.json().get("access_token")
        if not access_token:
            return denied("google_unavailable")

        userinfo_res = httpx.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=10.0,
        )
        userinfo_res.raise_for_status()
        info = userinfo_res.json()
    except httpx.HTTPError:
        logger.exception("Google OAuth token/userinfo exchange failed")
        return denied("google_unavailable")

    google_id = info.get("sub")
    email = (info.get("email") or "").lower().strip()
    if not google_id or not email or not info.get("email_verified"):
        return denied("google_email_unverified")

    user = db.query(User).filter(User.googleId == google_id).first()
    if not user:
        user = db.query(User).filter(User.email == email).first()
        if user:
            user.googleId = google_id
            db.commit()

    if user:
        session = _create_session(db, user.id)
        db.commit()
        redirect = RedirectResponse(f"{settings.APP_URL}/auth/callback?token={session.token}")
    else:
        # No account exists yet — the schema requires a grade/board, which
        # Google doesn't give us, so hand the browser a signed token and let
        # the signup page collect it before the account is actually created.
        pending = sign_payload({"sub": google_id, "email": email, "name": info.get("name") or ""})
        display_params = urlencode({"google_pending": pending, "name": info.get("name") or "", "email": email})
        redirect = RedirectResponse(f"{settings.APP_URL}/signup?{display_params}")

    redirect.delete_cookie("google_oauth_state", path="/api/auth/google")
    return redirect

@router.post("/google/complete-signup", status_code=201)
@limiter.limit("10/minute")
def google_complete_signup(
    request: Request,
    payload: GoogleCompleteSignupRequest,
    response: Response,
    db: DBSession = Depends(get_db),
):
    data = verify_payload(payload.token)
    if not data or not data.get("sub") or not data.get("email"):
        raise HTTPException(
            status_code=400,
            detail="This sign-up link has expired. Please try 'Continue with Google' again.",
        )

    google_id = data["sub"]
    email = data["email"]

    user = db.query(User).filter(User.googleId == google_id).first()
    if not user:
        user = db.query(User).filter(User.email == email).first()
        if user:
            user.googleId = google_id
            db.commit()

    if not user:
        user = User(
            id=f"user_{uuid.uuid4().hex}",
            role="STUDENT",
            grade=payload.grade.strip().upper(),
            name=payload.name.strip(),
            email=email,
            passwordHash=None,
            googleId=google_id,
            locale=settings.DEFAULT_LOCALE,
            timezone=settings.DEFAULT_TIMEZONE,
            createdAt=_to_naive_utc(now_utc()),
        )
        db.add(user)
        db.flush()
        _attach_free_subscription(db, user.id)

    session = _create_session(db, user.id)
    db.commit()
    response.set_cookie("viswasimi_session", session.token, **cookie_settings())
    return {"user": _serialize_user(user), "sessionToken": session.token}