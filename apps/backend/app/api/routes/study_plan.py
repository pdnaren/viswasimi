import uuid
from datetime import timedelta, datetime
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session as DBSession
from sqlalchemy import not_, or_, and_

from app.api.dependencies import get_db, get_current_user, now_utc, _to_naive_utc
from app.models.user import User
from app.models.tutoring import StudyPlan, PlanItem
from app.models.progress import Progress, Mastery
from app.models.curriculum import Topic, Chapter, Subject
from app.schemas.tutoring import PlanItemRequest

router = APIRouter()

def _get_next_unscheduled_topics(db: DBSession, user: User):
    next_topics = []
    subjects = db.query(Subject).filter(Subject.grade == user.grade).all()

    for subj in subjects:
        topic = (
            db.query(Topic)
            .join(Chapter, Chapter.id == Topic.chapterId)
            .filter(Chapter.subjectId == subj.id)
            .filter(
                not_(
                    db.query(Mastery.topicId)
                    .filter(
                        Mastery.userId == user.id,
                        Mastery.topicId == Topic.id,
                        Mastery.value >= 5,
                    )
                    .exists()
                ),
                not_(
                    db.query(PlanItem.topicId)
                    .join(StudyPlan, StudyPlan.id == PlanItem.planId)
                    .filter(StudyPlan.userId == user.id, PlanItem.topicId == Topic.id)
                    .exists()
                ),
            )
            .order_by(Chapter.order.asc(), Topic.order.asc())
            .first()
        )
        if topic:
            next_topics.append(topic)
    return next_topics

@router.post("/create")
def create_study_plan(
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    db.query(StudyPlan).filter(StudyPlan.userId == user.id).update({"active": False})
    db.flush()
    plan = StudyPlan(id=f"plan_{uuid.uuid4().hex}", userId=user.id, active=True)
    db.add(plan)
    db.commit()
    return {"ok": True, "planId": plan.id}

@router.post("/add-item")
def add_plan_item(
    payload: PlanItemRequest,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    plan = db.query(StudyPlan).filter(StudyPlan.userId == user.id, StudyPlan.active.is_(True)).first()
    if not plan:
        plan = StudyPlan(id=f"plan_{uuid.uuid4().hex}", userId=user.id, active=True)
        db.add(plan)
        db.flush()

    existing_item = (
        db.query(PlanItem)
        .filter(
            PlanItem.planId == plan.id,
            PlanItem.topicId == payload.topicId,
            PlanItem.state.in_(["SCHEDULED", "IN_PROGRESS"]),
        )
        .first()
    )

    start_time = _to_naive_utc(payload.startsAt) if payload.startsAt else _to_naive_utc(now_utc())
    topic = db.query(Topic).filter(Topic.id == payload.topicId).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
        
    end_time = (
        _to_naive_utc(payload.endsAt)
        if payload.endsAt
        else (start_time + timedelta(minutes=topic.durationM or 45))
    )

    if existing_item:
        existing_item.startsAt = start_time
        existing_item.endsAt = end_time
        existing_item.state = "SCHEDULED"
        db.commit()
        return {"ok": True, "message": "Topic moved to your requested time", "itemId": existing_item.id}

    new_item = PlanItem(
        id=f"pi_{uuid.uuid4().hex}",
        planId=plan.id,
        topicId=payload.topicId,
        startsAt=start_time,
        endsAt=end_time,
        state="SCHEDULED",
        targetMastery=payload.targetMastery or 5,
    )
    db.add(new_item)
    db.commit()
    return {"ok": True, "itemId": new_item.id}

@router.patch("/item/{item_id}/state")
def update_plan_item_state(
    item_id: str,
    payload: dict,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    item = (
        db.query(PlanItem)
        .join(StudyPlan, StudyPlan.id == PlanItem.planId)
        .filter(PlanItem.id == item_id, StudyPlan.userId == user.id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Plan item not found")

    valid_states = {"SCHEDULED", "IN_PROGRESS", "DONE", "MISSED", "RESCHEDULED"}
    new_state = payload.get("state", "").upper()
    if new_state not in valid_states:
        raise HTTPException(status_code=400, detail=f"Invalid state. Must be one of: {', '.join(valid_states)}")

    item.state = new_state
    db.commit()
    return {"ok": True, "state": item.state}

@router.delete("/item/{item_id}")
def delete_plan_item(
    item_id: str,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    item = (
        db.query(PlanItem)
        .join(StudyPlan, StudyPlan.id == PlanItem.planId)
        .filter(PlanItem.id == item_id, StudyPlan.userId == user.id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Plan item not found")

    db.delete(item)
    db.commit()
    return {"ok": True, "message": "Item removed from plan"}

@router.get("/today")
def study_plan_today(
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    now = now_utc()
    today_start = _to_naive_utc(now.replace(hour=0, minute=0, second=0, microsecond=0))
    tomorrow_start = today_start + timedelta(days=1)

    plan = db.query(StudyPlan).filter(StudyPlan.userId == user.id, StudyPlan.active.is_(True)).first()
    if not plan:
        plan = StudyPlan(id=f"plan_{uuid.uuid4().hex}", userId=user.id, active=True)
        db.add(plan)
        db.flush()

    for target_date in [today_start, tomorrow_start]:
        has_items = (
            db.query(PlanItem)
            .filter(
                PlanItem.planId == plan.id,
                PlanItem.startsAt >= target_date,
                PlanItem.startsAt < (target_date + timedelta(days=1)),
            )
            .count()
            > 0
        )

        if not has_items:
            if target_date == today_start:
                done_today = (
                    db.query(Progress)
                    .filter(
                        Progress.userId == user.id,
                        Progress.ts >= today_start,
                        Progress.event == "COMPLETED",
                    )
                    .count()
                    > 0
                )
                if done_today:
                    continue

            new_topics = _get_next_unscheduled_topics(db, user)
            for i, t in enumerate(new_topics):
                start_time = target_date + timedelta(hours=9, minutes=i * 60)
                db.add(
                    PlanItem(
                        id=f"pi_{uuid.uuid4().hex}",
                        planId=plan.id,
                        topicId=t.id,
                        startsAt=start_time,
                        endsAt=start_time + timedelta(minutes=t.durationM or 45),
                        state="SCHEDULED",
                        targetMastery=5,
                    )
                )
            db.commit()

    rows = (
        db.query(PlanItem, Topic, Chapter, Subject)
        .join(Topic, Topic.id == PlanItem.topicId)
        .join(Chapter, Chapter.id == Topic.chapterId)
        .join(Subject, Subject.id == Chapter.subjectId)
        .filter(
            PlanItem.planId == plan.id,
            or_(
                and_(
                    PlanItem.startsAt >= today_start,
                    PlanItem.startsAt < tomorrow_start,
                ),
                and_(
                    PlanItem.startsAt < today_start,
                    PlanItem.state.in_(["SCHEDULED", "IN_PROGRESS"]),
                ),
            ),
        )
        .order_by(PlanItem.startsAt.asc())
        .all()
    )

    return {
        "items": [
            {
                "id": row.PlanItem.id,
                "topicId": row.PlanItem.topicId,
                "topicName": row.Topic.name,
                "chapterName": row.Chapter.name,
                "subjectName": row.Subject.name,
                "state": row.PlanItem.state,
                "startsAt": row.PlanItem.startsAt.isoformat(),
                "endsAt": row.PlanItem.endsAt.isoformat() if row.PlanItem.endsAt else None,
                "isOverdue": row.PlanItem.startsAt < today_start,
            }
            for row in rows
        ]
    }