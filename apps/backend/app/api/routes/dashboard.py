from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session as DBSession
from sqlalchemy import asc, func, not_

from app.api.dependencies import get_db, get_current_user
from app.models.user import User
from app.models.curriculum import Subject, Chapter, Topic
from app.models.progress import Progress, Mastery, DailyProgress

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

@router.get("/overview")
def dashboard_overview(
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    recommended_topics = []
    subjects           = db.query(Subject).filter(Subject.grade == user.grade).all()

    for subj in subjects:
        next_topic = (
            db.query(Topic)
            .join(Chapter, Chapter.id == Topic.chapterId)
            .filter(Chapter.subjectId == subj.id)
            .filter(
                not_(
                    db.query(Progress.topicId)
                    .filter(
                        Progress.userId == user.id,
                        Progress.event == "COMPLETED",
                        Progress.topicId == Topic.id,
                    )
                    .exists()
                )
            )
            .order_by(asc(Chapter.order), asc(Topic.order))
            .first()
        )

        if next_topic:
            m_record = (
                db.query(Mastery)
                .filter(Mastery.userId == user.id, Mastery.topicId == next_topic.id)
                .first()
            )
            recommended_topics.append({
                "id":          next_topic.id,
                "name":        next_topic.name,
                "subjectName": subj.name,
                "chapterName": next_topic.chapter.name,
                "mastery":     m_record.value if m_record else 0,
                "state":       "available",
                "durationM":   next_topic.durationM,
            })

    ai_questions = (
        db.query(Progress)
        .filter(Progress.userId == user.id, Progress.event == "CHECKPOINT")
        .count()
    )
    topics_completed = (
        db.query(Mastery).filter(Mastery.userId == user.id, Mastery.value >= 5).count()
    )
    avg_accuracy = (
        db.query(func.avg(Progress.score))
        .filter(
            Progress.userId == user.id,
            Progress.event == "CHECKPOINT",
            Progress.score.isnot(None),
        )
        .scalar()
        or 0
    )
    streak = (
        db.query(func.max(DailyProgress.streak))
        .filter(DailyProgress.userId == user.id)
        .scalar()
        or 0
    )

    return {
        "user": _serialize_user(user),
        "stats": {
            "aiQuestionsAsked": ai_questions,
            "topicsCompleted":  topics_completed,
            "accuracyScore":    round(float(avg_accuracy)),
            "dailyStreak":      int(streak),
        },
        "recommendedTopics": recommended_topics,
    }