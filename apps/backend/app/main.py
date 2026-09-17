from datetime import datetime
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.core.rate_limit import limiter
from app.api.routes import chat,auth,progress,study_plan,curriculum,dashboard,payments, admin, profile, assessments, notifications

# We will import and add the rest of the routers in Part 2
# from app.api.routes import auth, admin, dashboard, payments, progress, study_plan

app = FastAPI(title="Viswasimi Backend", version="1.5.0")

# Setup Rate Limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.ALLOWED_ORIGINS.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health Check Route
@app.get("/api/health", tags=["Health"])
def health():
    return {"ok": True, "service": "backend", "ts": int(datetime.now().timestamp() * 1000)}

# Include Routers
app.include_router(chat.router, prefix="/api/chat", tags=["Chat"])
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(progress.router, prefix="/api", tags=["Progress & Mastery"])
app.include_router(study_plan.router, prefix="/api/study-plan", tags=["Study Plan"])
app.include_router(curriculum.router, prefix="/api/curriculum", tags=["Curriculum"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])
app.include_router(payments.router, prefix="/api/payments", tags=["Payments"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin"])
app.include_router(profile.router, prefix="/api/profile", tags=["Profile"])
app.include_router(assessments.router, prefix="/api/assessments", tags=["Assessments"])
app.include_router(notifications.router, prefix="/api", tags=["Notifications"])
# Add the cancel subscription route to profile router mapping
profile.router.post("/cancel-subscription")(payments.cancel_subscription)