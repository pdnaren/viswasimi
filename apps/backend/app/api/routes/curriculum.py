from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session as DBSession
from sqlalchemy import func

from app.api.dependencies import get_db, get_current_user
from app.models.user import User
from app.models.curriculum import Subject, Chapter, Topic
from app.models.progress import Progress, Mastery
from app.models.tutoring import StudyPlan, PlanItem

router = APIRouter()

def _topic_lookup(db: DBSession, user: User):
    started_sub = (
        db.query(Progress.topicId, func.min(Progress.ts).label("started_at"))
        .filter(Progress.userId == user.id, Progress.event == "STARTED")
        .group_by(Progress.topicId)
        .subquery()
    )
    completed_sub = (
        db.query(Progress.topicId, func.min(Progress.ts).label("completed_at"))
        .filter(Progress.userId == user.id, Progress.event == "COMPLETED")
        .group_by(Progress.topicId)
        .subquery()
    )
    last_act_sub = (
        db.query(Progress.topicId, func.max(Progress.ts).label("last_at"))
        .filter(Progress.userId == user.id)
        .group_by(Progress.topicId)
        .subquery()
    )

    return (
        db.query(
            Subject.id.label("subject_id"),
            Subject.name.label("subject_name"),
            Chapter.id.label("chapter_id"),
            Chapter.name.label("chapter_name"),
            Chapter.order.label("chapter_order"),
            Topic.id.label("topic_id"),
            Topic.name.label("topic_name"),
            Topic.order.label("topic_order"),
            Topic.durationM.label("duration_m"),
            Topic.prereqIds.label("prereq_ids"),
            Topic.videoUrl.label("video_url"),
            Mastery.value.label("mastery_value"),
            PlanItem.state.label("plan_state"),
            started_sub.c.started_at,
            completed_sub.c.completed_at,
            last_act_sub.c.last_at,
        )
        .join(Chapter, Chapter.subjectId == Subject.id)
        .join(Topic, Topic.chapterId == Chapter.id)
        .outerjoin(Mastery, (Mastery.topicId == Topic.id) & (Mastery.userId == user.id))
        .outerjoin(StudyPlan, (StudyPlan.userId == user.id) & (StudyPlan.active.is_(True)))
        .outerjoin(PlanItem, (PlanItem.planId == StudyPlan.id) & (PlanItem.topicId == Topic.id))
        .outerjoin(started_sub, started_sub.c.topicId == Topic.id)
        .outerjoin(completed_sub, completed_sub.c.topicId == Topic.id)
        .outerjoin(last_act_sub, last_act_sub.c.topicId == Topic.id)
        .filter(Subject.grade == user.grade)
        .order_by(Subject.name.asc(), Chapter.order.asc(), Topic.order.asc())
        .all()
    )

def _compute_curriculum(rows):
    subjects_map = {}
    recommended  = []
    seen_topics  = set()
    mastery_map  = {row.topic_id: int(row.mastery_value or 0) for row in rows}

    for row in rows:
        if row.topic_id in seen_topics:
            continue
        seen_topics.add(row.topic_id)

        if row.subject_id not in subjects_map:
            subjects_map[row.subject_id] = {
                "id": row.subject_id, "name": row.subject_name,
                "chapters": [], "startedAt": None, "completedAt": None,
                "lastStudiedAt": None, "totalChapters": 0, "completedChapters": 0,
                "_start_dates": [], "_end_dates": [], "_last_dates": [], "_chapters_map": {},
            }
        subj = subjects_map[row.subject_id]

        if row.chapter_id not in subj["_chapters_map"]:
            new_chapter = {
                "id": row.chapter_id, "name": row.chapter_name, "order": row.chapter_order,
                "topics": [], "startedAt": None, "completedAt": None, "lastStudiedAt": None,
                "totalTopics": 0, "completedTopics": 0,
                "_start_dates": [], "_end_dates": [], "_last_dates": [],
            }
            subj["chapters"].append(new_chapter)
            subj["_chapters_map"][row.chapter_id] = new_chapter
            subj["totalChapters"] += 1
        chap = subj["_chapters_map"][row.chapter_id]

        prereq_ids        = row.prereq_ids or []
        prerequisites_met = all(mastery_map.get(p, 0) >= 3 for p in prereq_ids)
        mastery_value     = int(row.mastery_value or 0)

        if mastery_value >= 5:
            state = "done"
        elif row.plan_state == "IN_PROGRESS" or 0 < mastery_value < 5:
            state = "in_progress"
        elif prerequisites_met:
            state = "available"
        else:
            state = "locked"

        topic_item = {
            "id":            row.topic_id,
            "name":          row.topic_name,
            "order":         row.topic_order,
            "durationM":     row.duration_m,
            "mastery":       mastery_value,
            "state":         state,
            "videoUrl":      row.video_url,
            "subjectName":   row.subject_name,
            "chapterName":   row.chapter_name,
            "startedAt":     row.started_at.isoformat() if row.started_at else None,
            "completedAt":   row.completed_at.isoformat() if row.completed_at else None,
            "lastStudiedAt": row.last_at.isoformat() if row.last_at else None,
        }
        chap["topics"].append(topic_item)

        if state in {"available", "in_progress"}:
            recommended.append(topic_item)

        chap["totalTopics"] += 1
        if state == "done":
            chap["completedTopics"] += 1

        if row.started_at:
            chap["_start_dates"].append(row.started_at)
            subj["_start_dates"].append(row.started_at)
        if row.completed_at:
            chap["_end_dates"].append(row.completed_at)
            subj["_end_dates"].append(row.completed_at)
        if row.last_at:
            chap["_last_dates"].append(row.last_at)
            subj["_last_dates"].append(row.last_at)

    for subj in subjects_map.values():
        if subj["_start_dates"]:
            subj["startedAt"] = min(subj["_start_dates"]).isoformat()
        if subj["_last_dates"]:
            subj["lastStudiedAt"] = max(subj["_last_dates"]).isoformat()

        completed_chapters_count = 0
        for chap in subj["chapters"]:
            if chap["_start_dates"]:
                chap["startedAt"] = min(chap["_start_dates"]).isoformat()
            if chap["_last_dates"]:
                chap["lastStudiedAt"] = max(chap["_last_dates"]).isoformat()

            if chap["totalTopics"] > 0 and chap["completedTopics"] == chap["totalTopics"]:
                completed_chapters_count += 1
                if chap["_end_dates"]:
                    chap["completedAt"] = max(chap["_end_dates"]).isoformat()

            for key in ["_start_dates", "_end_dates", "_last_dates"]:
                chap.pop(key, None)

        subj["completedChapters"] = completed_chapters_count
        if subj["totalChapters"] > 0 and subj["completedChapters"] == subj["totalChapters"]:
            if subj["_end_dates"]:
                subj["completedAt"] = max(subj["_end_dates"]).isoformat()

        for key in ["_start_dates", "_end_dates", "_last_dates", "_chapters_map"]:
            subj.pop(key, None)

    return {"subjects": list(subjects_map.values()), "recommended": recommended[:6]}

@router.get("/")
def curriculum_endpoint(
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    return _compute_curriculum(_topic_lookup(db, user))

@router.get("/search")
def search_curriculum(
    q: str = Query(..., min_length=1, max_length=100),
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """Search by concept/topic (PRD §37) — matches topic, chapter, or subject
    name and returns each hit with its state/mastery/breadcrumb so the
    frontend can link straight into the lesson or a practice quiz."""
    needle = q.strip().lower()
    data = _compute_curriculum(_topic_lookup(db, user))

    results = []
    for subject in data["subjects"]:
        subject_match = needle in subject["name"].lower()
        for chapter in subject["chapters"]:
            chapter_match = subject_match or needle in chapter["name"].lower()
            for topic in chapter["topics"]:
                if chapter_match or needle in topic["name"].lower():
                    results.append({
                        **topic,
                        "subjectId": subject["id"],
                        "chapterId": chapter["id"],
                    })

    return {"query": q, "results": results[:30]}