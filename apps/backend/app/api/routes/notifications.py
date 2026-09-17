from datetime import timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session as DBSession

from app.api.dependencies import get_db, get_current_user, now_utc, _to_naive_utc
from app.models.user import User
from app.models.progress import Mastery
from app.models.curriculum import Topic, Chapter, Subject
from app.models.tutoring import StudyPlan, PlanItem

router = APIRouter()


@router.get("/notifications")
def get_notifications(
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """Computed on demand (PRD §36) rather than persisted/pushed — no
    background job or push-notification infrastructure exists, so this
    surfaces the same information as an in-app notification list whenever
    the dashboard asks for it."""
    now = _to_naive_utc(now_utc())
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow_start = today_start + timedelta(days=1)

    notifications = []

    due_rows = (
        db.query(Mastery, Topic, Subject)
        .join(Topic, Topic.id == Mastery.topicId)
        .join(Chapter, Chapter.id == Topic.chapterId)
        .join(Subject, Subject.id == Chapter.subjectId)
        .filter(Mastery.userId == user.id, Mastery.nextReviewAt <= now, Mastery.value < 5)
        .order_by(Mastery.nextReviewAt.asc())
        .limit(5)
        .all()
    )
    for _mastery, topic, subject in due_rows:
        notifications.append({
            "type": "REVISION_DUE",
            "title": f"Revision due: {topic.name}",
            "body": f"It's time to revise {topic.name} ({subject.name}) to keep your mastery up.",
            "topicId": topic.id,
            "priority": 2,
        })

    plan = db.query(StudyPlan).filter(StudyPlan.userId == user.id, StudyPlan.active.is_(True)).first()
    if plan:
        today_items = (
            db.query(PlanItem, Topic)
            .join(Topic, Topic.id == PlanItem.topicId)
            .filter(PlanItem.planId == plan.id, PlanItem.startsAt >= today_start, PlanItem.startsAt < tomorrow_start)
            .all()
        )
        overdue_count = (
            db.query(PlanItem)
            .filter(
                PlanItem.planId == plan.id,
                PlanItem.startsAt < today_start,
                PlanItem.state.in_(["SCHEDULED", "IN_PROGRESS"]),
            )
            .count()
        )
        pending_today = [topic for item, topic in today_items if item.state in ("SCHEDULED", "IN_PROGRESS")]

        if overdue_count > 0:
            notifications.append({
                "type": "LESSON_INCOMPLETE",
                "title": f"{overdue_count} lesson{'s' if overdue_count != 1 else ''} incomplete",
                "body": "You have overdue lessons from previous days. Pick up where you left off.",
                "topicId": None,
                "priority": 1,
            })
        elif pending_today:
            first = pending_today[0]
            notifications.append({
                "type": "DAILY_LESSON_READY",
                "title": "Today's lesson is ready",
                "body": f"Continue with {first.name} to keep your streak going.",
                "topicId": first.id,
                "priority": 3,
            })

    notifications.sort(key=lambda n: n["priority"])
    return {"notifications": notifications[:10]}
