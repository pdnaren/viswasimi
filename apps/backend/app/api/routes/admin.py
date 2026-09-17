import uuid
from datetime import timedelta

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Query, UploadFile, File, Form
from sqlalchemy import func, or_
from sqlalchemy.orm import Session as DBSession

from app.api.dependencies import get_db, get_current_user, get_active_subscription, now_utc, _to_naive_utc
from app.core.config import settings
from app.models.user import User
from app.models.curriculum import Subject, Chapter, Topic
from app.models.tutoring import ChatMessage
from app.models.progress import Mastery
from app.models.billing import SubscriptionPlan, UserSubscription
from app.models.assessment import Assessment, Mistake
from app.schemas.curriculum import SubjectSeedRequest
from app.schemas.admin import OverrideSubscriptionRequest

router = APIRouter()

def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

@router.get("/grades")
def list_available_grades(
    admin_user: User = Depends(require_admin),
    db: DBSession = Depends(get_db),
):
    grades = db.query(Subject.grade).distinct().order_by(Subject.grade.asc()).all()
    return {"grades": [g[0] for g in grades]}

@router.get("/subjects")
def list_subjects(
    grade: str | None = Query(default=None),
    admin_user: User = Depends(require_admin),
    db: DBSession = Depends(get_db),
):
    query = db.query(Subject)
    if grade is not None:
        query = query.filter(Subject.grade == grade)

    subjects = query.order_by(Subject.grade.asc(), Subject.name.asc()).all()
    result   = []
    for s in subjects:
        chapters = db.query(Chapter).filter(Chapter.subjectId == s.id).order_by(Chapter.order).all()
        chap_list = []
        for c in chapters:
            topics = db.query(Topic).filter(Topic.chapterId == c.id).order_by(Topic.order).all()
            chap_list.append({
                "id": c.id, "name": c.name, "order": c.order,
                "topics": [
                    {
                        "id": t.id, "name": t.name, "order": t.order,
                        "durationM": t.durationM, "prereqIds": t.prereqIds,
                        "contentRef": t.contentRef,
                    }
                    for t in topics
                ],
            })
        result.append({"id": s.id, "grade": s.grade, "name": s.name, "chapters": chap_list})

    return {"subjects": result}

@router.post("/seed-curriculum")
def seed_curriculum(
    payload: SubjectSeedRequest,
    admin_user: User = Depends(require_admin),
    db: DBSession = Depends(get_db),
):
    created = {"subjects": 0, "chapters": 0, "topics": 0}

    for subj_data in payload.subjects:
        subject = db.query(Subject).filter(Subject.grade == payload.grade, Subject.name == subj_data.name).first()
        if not subject:
            subject = Subject(id=f"subj_{uuid.uuid4().hex}", grade=payload.grade, name=subj_data.name)
            db.add(subject)
            db.flush()
            created["subjects"] += 1

        for chap_data in subj_data.chapters:
            chapter = db.query(Chapter).filter(Chapter.subjectId == subject.id, Chapter.order == chap_data.order).first()
            if not chapter:
                chapter = Chapter(id=f"chap_{uuid.uuid4().hex}", subjectId=subject.id, name=chap_data.name, order=chap_data.order)
                db.add(chapter)
                db.flush()
                created["chapters"] += 1
            else:
                chapter.name = chap_data.name

            for topic_data in chap_data.topics:
                topic = db.query(Topic).filter(Topic.chapterId == chapter.id, Topic.order == topic_data.order).first()
                if not topic:
                    topic = Topic(
                        id=f"topic_{uuid.uuid4().hex}", chapterId=chapter.id, name=topic_data.name,
                        order=topic_data.order, durationM=topic_data.durationM,
                        prereqIds=topic_data.prereqIds or [], contentRef=topic_data.contentRef,
                    )
                    db.add(topic)
                    created["topics"] += 1
                else:
                    topic.name = topic_data.name
                    topic.durationM = topic_data.durationM
                    topic.prereqIds = topic_data.prereqIds or []
                    topic.contentRef = topic_data.contentRef

    db.commit()
    return {"ok": True, "created": created}

@router.post("/ingest")
async def proxy_ingest(
    grade: str = Form(...),
    subject: str = Form(...),
    chapterId: str = Form(...),
    topicId: str = Form(...),
    file: UploadFile = File(...),
    admin_user: User = Depends(require_admin),
):
    file_bytes = await file.read(settings.MAX_UPLOAD_BYTES + 1)
    if len(file_bytes) > settings.MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File too large.")

    try:
        async with httpx.AsyncClient(timeout=300.0) as client:
            res = await client.post(
                f"{settings.RAG_BACKEND_URL}/api/ingest",
                headers={"X-Internal-Key": settings.INTERNAL_API_KEY},
                data={
                    "grade": grade,
                    "subject": subject,
                    "chapterId": chapterId,
                    "topicId": topicId
                },
                files={"file": (file.filename, file_bytes, file.content_type)}
            )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Could not reach the RAG backend: {exc}")

    if res.status_code != 200:
        raise HTTPException(status_code=res.status_code, detail=res.text)

    return res.json()

# ─────────────────────────────────────────────────────────────────────────────
# Student & subscription management
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/users")
def list_users(
    search: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    pageSize: int = Query(default=20, ge=1, le=100),
    admin_user: User = Depends(require_admin),
    db: DBSession = Depends(get_db),
):
    query = db.query(User)
    if search:
        like = f"%{search.strip()}%"
        query = query.filter(or_(User.name.ilike(like), User.email.ilike(like)))

    total = query.count()
    users = query.order_by(User.createdAt.desc()).offset((page - 1) * pageSize).limit(pageSize).all()

    return {
        "total": total,
        "page": page,
        "pageSize": pageSize,
        "users": [
            {
                "id": u.id, "name": u.name, "email": u.email, "grade": u.grade,
                "role": u.role, "createdAt": u.createdAt.isoformat() if u.createdAt else None,
                "planName": (sub.plan.name if (sub := get_active_subscription(u.id, db)) and sub.plan else None),
            }
            for u in users
        ],
    }

@router.get("/users/{user_id}")
def get_user_detail(
    user_id: str,
    admin_user: User = Depends(require_admin),
    db: DBSession = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    sub = get_active_subscription(user.id, db)
    assessments = (
        db.query(Assessment)
        .filter(Assessment.userId == user.id, Assessment.status == "COMPLETED")
        .order_by(Assessment.completedAt.desc())
        .limit(10)
        .all()
    )
    topics_mastered = db.query(func.count(Mastery.id)).filter(Mastery.userId == user.id, Mastery.value >= 5).scalar() or 0
    chat_messages = db.query(func.count(ChatMessage.id)).filter(ChatMessage.userId == user.id).scalar() or 0

    return {
        "user": {
            "id": user.id, "name": user.name, "email": user.email, "grade": user.grade,
            "role": user.role, "createdAt": user.createdAt.isoformat() if user.createdAt else None,
            "hasGoogleLogin": bool(user.googleId),
        },
        "subscription": {
            "planName": sub.plan.name if sub.plan else None,
            "startsAt": sub.startsAt.isoformat() if sub.startsAt else None,
            "endsAt": sub.endsAt.isoformat() if sub.endsAt else None,
        } if sub else None,
        "stats": {"topicsMastered": topics_mastered, "chatMessages": chat_messages},
        "recentAssessments": [
            {"id": a.id, "type": a.type, "score": a.score, "completedAt": a.completedAt.isoformat() if a.completedAt else None}
            for a in assessments
        ],
    }

@router.post("/users/{user_id}/subscription")
def override_subscription(
    user_id: str,
    payload: OverrideSubscriptionRequest,
    admin_user: User = Depends(require_admin),
    db: DBSession = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.name == payload.planName.lower().strip()).first()
    if not plan:
        raise HTTPException(status_code=404, detail=f"Plan '{payload.planName}' not found")

    db.query(UserSubscription).filter(
        UserSubscription.userId == user.id, UserSubscription.isActive.is_(True)
    ).update({"isActive": False})

    ends_at = _to_naive_utc(now_utc() + timedelta(days=payload.days)) if payload.days else None
    new_sub = UserSubscription(
        id=f"sub_{uuid.uuid4().hex}", userId=user.id, planId=plan.id,
        startsAt=_to_naive_utc(now_utc()), endsAt=ends_at, isActive=True,
    )
    db.add(new_sub)
    db.commit()
    return {"ok": True, "planName": plan.name, "endsAt": ends_at.isoformat() if ends_at else None}

# ─────────────────────────────────────────────────────────────────────────────
# Usage monitoring
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/usage/summary")
def usage_summary(
    admin_user: User = Depends(require_admin),
    db: DBSession = Depends(get_db),
):
    total_users = db.query(func.count(User.id)).scalar() or 0
    by_grade = db.query(User.grade, func.count(User.id)).group_by(User.grade).all()
    by_plan = (
        db.query(SubscriptionPlan.name, func.count(UserSubscription.id))
        .join(UserSubscription, UserSubscription.planId == SubscriptionPlan.id)
        .filter(UserSubscription.isActive.is_(True))
        .group_by(SubscriptionPlan.name)
        .all()
    )

    seven_days_ago = _to_naive_utc(now_utc() - timedelta(days=7))
    new_signups_7d = db.query(func.count(User.id)).filter(User.createdAt >= seven_days_ago).scalar() or 0

    total_chat_messages = db.query(func.count(ChatMessage.id)).scalar() or 0
    total_assessments = db.query(func.count(Assessment.id)).filter(Assessment.status == "COMPLETED").scalar() or 0
    avg_score = db.query(func.avg(Assessment.score)).filter(Assessment.status == "COMPLETED").scalar()
    mistakes_by_category = db.query(Mistake.category, func.count(Mistake.id)).group_by(Mistake.category).all()

    return {
        "totalUsers": total_users,
        "newSignups7d": new_signups_7d,
        "usersByGrade": [{"grade": g, "count": c} for g, c in by_grade],
        "activeSubscriptionsByPlan": [{"planName": p, "count": c} for p, c in by_plan],
        "totalChatMessages": total_chat_messages,
        "totalAssessmentsCompleted": total_assessments,
        "averageAssessmentScore": round(avg_score) if avg_score is not None else None,
        "mistakesByCategory": [{"category": c, "count": n} for c, n in mistakes_by_category],
    }