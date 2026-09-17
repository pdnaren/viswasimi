"""Short-lived signed tokens for the Google-signup handoff.

A brand-new "Continue with Google" user needs to pick a grade/board before
an account can be created (the schema requires it), so the OAuth callback
can't create the User row directly. Instead it hands the browser a signed,
expiring token carrying the verified Google identity; the frontend collects
the grade and posts both back to /api/auth/google/complete-signup. Signing
with INTERNAL_API_KEY (already a required server-side secret) means the
token's claims can't be forged or edited by the client.
"""
import base64
import hashlib
import hmac
import json
import time

from app.core.config import settings


def _signing_key() -> bytes:
    return settings.INTERNAL_API_KEY.encode("utf-8")


def sign_payload(data: dict, ttl_seconds: int = 900) -> str:
    payload = {**data, "exp": int(time.time()) + ttl_seconds}
    raw = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    sig = hmac.new(_signing_key(), raw, hashlib.sha256).digest()
    return f"{base64.urlsafe_b64encode(raw).decode()}.{base64.urlsafe_b64encode(sig).decode()}"


def verify_payload(token: str) -> dict | None:
    try:
        raw_b64, sig_b64 = token.split(".", 1)
        raw = base64.urlsafe_b64decode(raw_b64.encode("utf-8"))
        sig = base64.urlsafe_b64decode(sig_b64.encode("utf-8"))
    except (ValueError, TypeError):
        return None

    expected_sig = hmac.new(_signing_key(), raw, hashlib.sha256).digest()
    if not hmac.compare_digest(sig, expected_sig):
        return None

    try:
        payload = json.loads(raw)
    except ValueError:
        return None

    if payload.get("exp", 0) < time.time():
        return None
    return payload
