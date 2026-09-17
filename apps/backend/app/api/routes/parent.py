import secrets
import uuid
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func, case
from sqlalchemy.orm import Session as DBSession

from app.api.dependencies import get_db, get_current_user, now_utc, _to_naive_utc
from app.core.rate_limit import limiter
from app.models.user import User
from app.models.parent import ParentAccessToken
from app.models.progress import Mastery, DailyProgress
from app.models.curriculum import Subject, Chapter, Topic
from app.models.tutoring import StudyPlan, PlanItem
from app.models.assessment import Assessment
from app.schemas.parent import CreateParentLinkRequest

router = APIRouter()


def _serialize_token(t: ParentAccessToken) -> dict:
    return {"id": t.id, "token": t.token, "label": t.label, "createdAt": t.createdAt.isoformat() if t.createdAt else None}


@router.post("/tokens", status_code=201)
def create_parent_link(
    payload: CreateParentLinkRequest,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    token = ParentAccessToken(
        id=f"pat_{uuid.uuid4().hex}", userId=user.id, token=secrets.token_urlsafe(24),
        label=payload.label, createdAt=_to_naive_utc(now_utc()),
    )
    db.add(token)
    db.commit()
    return _serialize_token(token)


@router.get("/tokens")
def list_parent_links(
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    tokens = (
        db.query(ParentAccessToken)
        .filter(ParentAccessToken.userId == user.id, ParentAccessToken.revokedAt.is_(None))
        .order_by(ParentAccessToken.createdAt.desc())
        .all()
    )
    return {"tokens": [_serialize_token(t) for t in tokens]}


@router.delete("/tokens/{token_id}")
def revoke_parent_link(
    token_id: str,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    token = db.query(ParentAccessToken).filter(ParentAccessToken.id == token_id, ParentAccessToken.userId == user.id).first()
    if not token:
        raise HTTPException(status_code=404, detail="Link not found")
    token.revokedAt = _to_naive_utc(now_utc())
    db.commit()
    return {"ok": True}


def _assessment_label(db: DBSession, a: Assessment) -> str:
    if a.topicId:
        topic = db.query(Topic).filter(Topic.id == a.topicId).first()
        return topic.name if topic else "Topic quiz"
    if a.chapterId:
        chapter = db.query(Chapter).filter(Chapter.id == a.chapterId).first()
        return chapter.name if chapter else "Chapter test"
    if a.subjectId:
        subject = db.query(Subject).filter(Subject.id == a.subjectId).first()
        return f"Diagnostic: {subject.name}" if subject else "Diagnostic"
    return "Assessment"


@router.get("/view/{token}")
@limiter.limit("30/minute")
def parent_view(
    request: Request,
    token: str,
    db: DBSession = Depends(get_db),
):
    """Public (no login) — PRD §33 Parent Dashboard, scoped down to a
    single unguessable, revocable, read-only link rather than a full
    parent-account system. See README 'Parent Dashboard' for why."""
    access = (
        db.query(ParentAccessToken)
        .filter(ParentAccessToken.token == token, ParentAccessToken.revokedAt.is_(None))
        .first()
    )
    if not access:
        raise HTTPException(status_code=404, detail="This link is invalid or has been revoked.")

    student = db.query(User).filter(User.id == access.userId).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    now = _to_naive_utc(now_utc())
    week_ago = now - timedelta(days=7)

    study_minutes_7d = (
        db.query(func.sum(DailyProgress.minutes))
        .filter(DailyProgress.userId == student.id, DailyProgress.date >= week_ago)
        .scalar()
    ) or 0
    streak = db.query(func.max(DailyProgress.streak)).filter(DailyProgress.userId == student.id).scalar() or 0

    mastery_rows = (
        db.query(
            Subject.name.label("subject"),
            func.count(func.distinct(Topic.id)).label("total_topics"),
            func.sum(func.coalesce(Mastery.value, 0)).label("mastery_sum"),
            func.sum(case((Mastery.value >= 5, 1), else_=0)).label("completed_topics"),
        )
        .join(Chapter, Chapter.subjectId == Subject.id)
        .join(Topic, Topic.chapterId == Chapter.id)
        .outerjoin(Mastery, (Mastery.topicId == Topic.id) & (Mastery.userId == student.id))
        .filter(Subject.grade == student.grade)
        .group_by(Subject.name)
        .all()
    )

    subject_mastery = []
    weak_areas = []
    topics_total = 0
    topics_completed = 0
    for row in mastery_rows:
        total = int(row.total_topics or 0)
        completed = int(row.completed_topics or 0)
        mastery_pct = round((float(row.mastery_sum or 0) / (total * 5)) * 100) if total > 0 else 0
        topics_total += total
        topics_completed += completed
        subject_mastery.append({"name": row.subject, "mastery": mastery_pct, "topicsCompleted": completed, "topicsTotal": total})
        if mastery_pct < 50:
            weak_areas.append(row.subject)

    recent_assessments = (
        db.query(Assessment)
        .filter(Assessment.userId == student.id, Assessment.status == "COMPLETED")
        .order_by(Assessment.completedAt.desc())
        .limit(5)
        .all()
    )

    plan = db.query(StudyPlan).filter(StudyPlan.userId == student.id, StudyPlan.active.is_(True)).first()
    upcoming = []
    if plan:
        rows = (
            db.query(PlanItem, Topic, Subject)
            .join(Topic, Topic.id == PlanItem.topicId)
            .join(Chapter, Chapter.id == Topic.chapterId)
            .join(Subject, Subject.id == Chapter.subjectId)
            .filter(
                PlanItem.planId == plan.id,
                PlanItem.state.in_(["SCHEDULED", "IN_PROGRESS"]),
                PlanItem.startsAt >= now,
            )
            .order_by(PlanItem.startsAt.asc())
            .limit(5)
            .all()
        )
        upcoming = [
            {"topicName": t.name, "subjectName": s.name, "startsAt": item.startsAt.isoformat()}
            for item, t, s in rows
        ]

    return {
        "studentName": student.name,
        "grade": student.grade,
        "studyTimeMinutes7d": int(study_minutes_7d),
        "streak": int(streak),
        "topicsCompleted": topics_completed,
        "topicsTotal": topics_total,
        "subjectMastery": subject_mastery,
        "weakAreas": weak_areas,
        "recentAssessments": [
            {
                "label": _assessment_label(db, a), "score": a.score,
                "completedAt": a.completedAt.isoformat() if a.completedAt else None,
            }
            for a in recent_assessments
        ],
        "upcomingLessons": upcoming,
    }
