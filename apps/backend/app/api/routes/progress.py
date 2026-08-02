import uuid
from datetime import timedelta, timezone, datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session as DBSession
from sqlalchemy import func, case

from app.api.dependencies import get_db, get_current_user, now_utc, _to_naive_utc, to_ist_str, IST
from app.models.user import User
from app.models.progress import Progress, DailyProgress, Mastery
from app.models.curriculum import Topic, Chapter, Subject
from app.schemas.progress import ProgressLogRequest, DailyUpdateRequest, MasteryUpdateRequest

router = APIRouter()

# ─────────────────────────────────────────────────────────────────────────────
# Progress Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/progress/overview")
def progress_overview(
    time_range: str = Query(default="week", alias="range", pattern="^(week|month)$"),
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    days = 7 if time_range == "week" else 28

    now_in_ist = datetime.now(IST)
    ist_today_midnight = now_in_ist.replace(hour=0, minute=0, second=0, microsecond=0)
    start_dt_utc = (ist_today_midnight.astimezone(timezone.utc).replace(tzinfo=None) - timedelta(days=days - 1))

    daily_rows = (
        db.query(DailyProgress)
        .filter(DailyProgress.userId == user.id, DailyProgress.date >= start_dt_utc)
        .order_by(DailyProgress.date.asc())
        .all()
    )

    daily_map = {row.date.date().isoformat(): row for row in daily_rows}
    daily = []
    for i in range(days):
        current_day = (ist_today_midnight - timedelta(days=(days - 1) - i)).date().isoformat()
        row = daily_map.get(current_day)
        daily.append({
            "date": current_day,
            "minutes": row.minutes if row else 0,
            "topicsCompleted": row.topicsCompleted if row else 0,
            "streak": row.streak if row else 0,
        })

    mastery_rows = (
        db.query(
            Subject.name.label("subject"),
            func.count(func.distinct(Topic.id)).label("total_topics"),
            func.sum(func.coalesce(Mastery.value, 0)).label("mastery_sum"),
            func.sum(case((Mastery.value >= 5, 1), else_=0)).label("completed_topics"),
        )
        .join(Chapter, Chapter.subjectId == Subject.id)
        .join(Topic, Topic.chapterId == Chapter.id)
        .outerjoin(Mastery, (Mastery.topicId == Topic.id) & (Mastery.userId == user.id))
        .filter(Subject.grade == user.grade)
        .group_by(Subject.name)
        .all()
    )

    accuracy_rows = (
        db.query(
            Subject.name.label("subject"),
            func.count(Progress.id).label("total_attempts"),
            func.sum(case((Progress.score >= 80, 1), else_=0)).label("correct_attempts"),
        )
        .join(Chapter, Chapter.subjectId == Subject.id)
        .join(Topic, Topic.chapterId == Chapter.id)
        .join(Progress, (Progress.topicId == Topic.id) & (Progress.userId == user.id))
        .filter(Subject.grade == user.grade, Progress.event == "CHECKPOINT")
        .group_by(Subject.name)
        .all()
    )

    acc_map = {row.subject: row for row in accuracy_rows}

    subject_mastery = []
    total_correct = 0
    total_attempts = 0

    for row in mastery_rows:
        topics_total = int(row.total_topics or 0)
        m_sum = float(row.mastery_sum or 0)
        completed = int(row.completed_topics or 0)

        acc_data = acc_map.get(row.subject)
        attempts = int(acc_data.total_attempts or 0) if acc_data else 0
        correct = int(acc_data.correct_attempts or 0) if acc_data else 0

        total_correct += correct
        total_attempts += attempts

        mastery_pct = round((m_sum / (topics_total * 5)) * 100) if topics_total > 0 else 0
        subject_accuracy = round((correct / attempts) * 100) if attempts > 0 else 0

        subject_mastery.append({
            "name": row.subject,
            "mastery": mastery_pct,
            "accuracy": subject_accuracy,
            "topicsTotal": topics_total,
            "topicsCompleted": completed,
            "topicsDone": completed,
            "attempts": attempts,
        })

    global_accuracy = round((total_correct / total_attempts) * 100) if total_attempts > 0 else 0

    recent_rows = (
        db.query(Progress, Topic.name.label("topic_name"), Subject.name.label("subject_name"))
        .join(Topic, Topic.id == Progress.topicId)
        .join(Chapter, Chapter.id == Topic.chapterId)
        .join(Subject, Subject.id == Chapter.subjectId)
        .filter(Progress.userId == user.id)
        .order_by(Progress.ts.desc())
        .limit(8)
        .all()
    )
    recent = [
        {
            "id": r.Progress.id,
            "type": r.Progress.event,
            "topic": r.topic_name,
            "subject": r.subject_name,
            "score": r.Progress.score,
            "ts": to_ist_str(r.Progress.ts),
        }
        for r in recent_rows
    ]

    return {
        "daily": daily,
        "subjectMastery": subject_mastery,
        "recent": recent,
        "stats": {
            "globalAccuracy": global_accuracy,
            "totalAttempts": total_attempts,
        },
    }

@router.post("/progress/log")
def log_progress(
    payload: ProgressLogRequest,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    db.add(Progress(
        id=f"prog_{uuid.uuid4().hex}",
        userId=user.id,
        topicId=payload.topicId,
        event=payload.event,
        score=float(payload.score),
        ts=_to_naive_utc(now_utc()),
    ))
    db.commit()
    return {"ok": True}

@router.post("/progress/daily-update")
def update_daily_progress(
    payload: DailyUpdateRequest,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    today = _to_naive_utc(now_utc().replace(hour=0, minute=0, second=0, microsecond=0))

    row = db.query(DailyProgress).filter(DailyProgress.userId == user.id, DailyProgress.date == today).first()

    if not row:
        yesterday = today - timedelta(days=1)
        prev = db.query(DailyProgress).filter(DailyProgress.userId == user.id, DailyProgress.date == yesterday).first()
        streak = (prev.streak + 1) if prev else 1
        row = DailyProgress(
            id=f"dp_{uuid.uuid4().hex}",
            userId=user.id,
            date=today,
            topicsCompleted=0,
            minutes=0,
            streak=streak,
        )
        db.add(row)
        db.flush()

    row.topicsCompleted += payload.topicsCompleted
    row.minutes += payload.minutes
    db.commit()
    return {"ok": True, "streak": row.streak, "totalMinutesToday": row.minutes}

# ─────────────────────────────────────────────────────────────────────────────
# Mastery Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/mastery/update")
def update_mastery(
    payload: MasteryUpdateRequest,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    topic = db.query(Topic).filter(Topic.id == payload.topicId).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    mastery = db.query(Mastery).filter(Mastery.userId == user.id, Mastery.topicId == payload.topicId).first()

    if not mastery:
        mastery = Mastery(
            id=f"mast_{uuid.uuid4().hex}",
            userId=user.id,
            topicId=payload.topicId,
            value=0,
            ef=2.5,
            streak=0,
        )
        db.add(mastery)
        db.flush()

    mastery.value = min(5, mastery.value + payload.increment)
    mastery.streak += 1

    intervals = [1, 3, 7, 14, 30]
    interval_days = intervals[min(mastery.streak - 1, len(intervals) - 1)]
    mastery.nextReviewAt = _to_naive_utc(now_utc() + timedelta(days=interval_days))

    db.commit()
    return {
        "ok": True,
        "mastery": mastery.value,
        "streak": mastery.streak,
        "nextReviewAt": mastery.nextReviewAt.isoformat(),
    }

@router.get("/mastery/due")
def mastery_due(
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    now = _to_naive_utc(now_utc())

    due_rows = (
        db.query(Mastery, Topic, Chapter, Subject)
        .join(Topic, Topic.id == Mastery.topicId)
        .join(Chapter, Chapter.id == Topic.chapterId)
        .join(Subject, Subject.id == Chapter.subjectId)
        .filter(Mastery.userId == user.id, Mastery.nextReviewAt <= now, Mastery.value < 5)
        .order_by(Mastery.nextReviewAt.asc())
        .limit(10)
        .all()
    )

    return {
        "due": [
            {
                "topicId": row.Mastery.topicId,
                "topicName": row.Topic.name,
                "chapterName": row.Chapter.name,
                "subjectName": row.Subject.name,
                "mastery": row.Mastery.value,
                "streak": row.Mastery.streak,
                "nextReviewAt": row.Mastery.nextReviewAt.isoformat(),
            }
            for row in due_rows
        ]
    }