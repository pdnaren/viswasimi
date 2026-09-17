import logging
import uuid
from datetime import timedelta

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session as DBSession

from app.api.dependencies import get_db, get_current_user, now_utc, _to_naive_utc
from app.core.config import settings
from app.models.curriculum import Chapter, Subject, Topic
from app.models.progress import Mastery, Progress
from app.models.user import User
from app.models.assessment import Assessment, AssessmentQuestion, Question
from app.schemas.assessment import AnswerQuestionRequest, StartAssessmentRequest

logger = logging.getLogger(__name__)
router = APIRouter()

MASTERY_PASS_THRESHOLD = 80


def _scope_topics(db: DBSession, payload: StartAssessmentRequest) -> tuple[list[Topic], str]:
    if payload.topicId:
        topic = db.query(Topic).filter(Topic.id == payload.topicId).first()
        if not topic:
            raise HTTPException(status_code=404, detail="Topic not found")
        return [topic], topic.name

    chapter = db.query(Chapter).filter(Chapter.id == payload.chapterId).first()
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")
    topics = db.query(Topic).filter(Topic.chapterId == chapter.id).order_by(Topic.order.asc()).all()
    if not topics:
        raise HTTPException(status_code=400, detail="This chapter has no topics yet")
    return topics, chapter.name


async def _generate_questions_for_topic(topic: Topic, subject_name: str, grade: str, count: int) -> list[dict]:
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            res = await client.post(
                f"{settings.RAG_BACKEND_URL}/api/generate-quiz",
                json={
                    "topicId": topic.id, "topicName": topic.name,
                    "subject": subject_name, "grade": grade, "count": count,
                },
                headers={"X-Internal-Key": settings.INTERNAL_API_KEY},
            )
            res.raise_for_status()
            return res.json().get("questions", [])
        except httpx.HTTPError:
            logger.exception("Quiz generation request to RAG backend failed for topic %s", topic.id)
            return []


async def _collect_questions(db: DBSession, topics: list[Topic], total_count: int) -> list[Question]:
    per_topic = max(1, total_count // len(topics))
    remainder = total_count - per_topic * len(topics)

    collected: list[Question] = []
    for i, topic in enumerate(topics):
        needed = per_topic + (1 if i < remainder else 0)

        existing = (
            db.query(Question)
            .filter(Question.topicId == topic.id)
            .order_by(func.random())
            .limit(needed)
            .all()
        )
        collected.extend(existing)
        shortfall = needed - len(existing)
        if shortfall <= 0:
            continue

        subject = (
            db.query(Subject)
            .join(Chapter, Chapter.subjectId == Subject.id)
            .filter(Chapter.id == topic.chapterId)
            .first()
        )
        generated = await _generate_questions_for_topic(
            topic, subject.name if subject else "", subject.grade if subject else "", shortfall,
        )
        for q in generated:
            row = Question(
                id=f"q_{uuid.uuid4().hex}",
                topicId=topic.id,
                prompt=q["prompt"],
                options=q["options"],
                correctIndex=q["correctIndex"],
                explanation=q.get("explanation"),
            )
            db.add(row)
            collected.append(row)
    if collected:
        db.flush()
    return collected[:total_count]


@router.post("/start")
async def start_assessment(
    payload: StartAssessmentRequest,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    topics, label = _scope_topics(db, payload)
    questions = await _collect_questions(db, topics, payload.count)

    if not questions:
        raise HTTPException(
            status_code=422,
            detail="No content has been ingested for this topic yet, so a quiz can't be generated. Ask an admin to upload the textbook chapter first.",
        )

    assessment = Assessment(
        id=f"asmt_{uuid.uuid4().hex}",
        userId=user.id,
        type="CHAPTER_TEST" if payload.chapterId else "TOPIC_QUIZ",
        topicId=payload.topicId,
        chapterId=payload.chapterId,
        status="IN_PROGRESS",
        totalQuestions=len(questions),
        startedAt=_to_naive_utc(now_utc()),
    )
    db.add(assessment)
    db.flush()

    items = []
    for i, question in enumerate(questions):
        item = AssessmentQuestion(
            id=f"aq_{uuid.uuid4().hex}", assessmentId=assessment.id,
            questionId=question.id, order=i,
        )
        db.add(item)
        items.append((item, question))
    db.commit()

    return {
        "assessmentId": assessment.id,
        "label": label,
        "questions": [
            {"itemId": item.id, "prompt": q.prompt, "options": q.options}
            for item, q in items
        ],
    }


@router.post("/{assessment_id}/answer")
def answer_question(
    assessment_id: str,
    payload: AnswerQuestionRequest,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    assessment = db.query(Assessment).filter(Assessment.id == assessment_id, Assessment.userId == user.id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    if assessment.status != "IN_PROGRESS":
        raise HTTPException(status_code=400, detail="This assessment is already finished")

    item = (
        db.query(AssessmentQuestion)
        .filter(AssessmentQuestion.id == payload.itemId, AssessmentQuestion.assessmentId == assessment.id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Question not found in this assessment")

    question = db.query(Question).filter(Question.id == item.questionId).first()
    is_correct = payload.selectedIndex == question.correctIndex

    item.selectedIndex = payload.selectedIndex
    item.isCorrect = is_correct
    item.answeredAt = _to_naive_utc(now_utc())
    db.commit()

    return {"isCorrect": is_correct, "correctIndex": question.correctIndex, "explanation": question.explanation}


@router.post("/{assessment_id}/finish")
def finish_assessment(
    assessment_id: str,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    assessment = db.query(Assessment).filter(Assessment.id == assessment_id, Assessment.userId == user.id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    if assessment.status == "COMPLETED":
        raise HTTPException(status_code=400, detail="This assessment is already finished")

    items = db.query(AssessmentQuestion).filter(AssessmentQuestion.assessmentId == assessment.id).all()
    correct_count = sum(1 for item in items if item.isCorrect)
    score = round(100 * correct_count / len(items)) if items else 0

    assessment.status = "COMPLETED"
    assessment.score = float(score)
    assessment.completedAt = _to_naive_utc(now_utc())

    topic_ids = {q.topicId for q in db.query(Question).filter(
        Question.id.in_([item.questionId for item in items])
    ).all()}

    for topic_id in topic_ids:
        db.add(Progress(
            id=f"prog_{uuid.uuid4().hex}", userId=user.id, topicId=topic_id,
            event="QUIZ", score=float(score), ts=_to_naive_utc(now_utc()),
        ))

        if score >= MASTERY_PASS_THRESHOLD:
            mastery = db.query(Mastery).filter(Mastery.userId == user.id, Mastery.topicId == topic_id).first()
            if not mastery:
                mastery = Mastery(id=f"mast_{uuid.uuid4().hex}", userId=user.id, topicId=topic_id, value=0, ef=2.5, streak=0)
                db.add(mastery)
                db.flush()
            mastery.value = min(5, mastery.value + 1)
            mastery.streak += 1
            intervals = [1, 3, 7, 14, 30]
            mastery.nextReviewAt = _to_naive_utc(now_utc() + timedelta(days=intervals[min(mastery.streak - 1, len(intervals) - 1)]))

    db.commit()

    return {
        "score": score,
        "correctCount": correct_count,
        "totalQuestions": len(items),
        "topicsUpdated": list(topic_ids),
    }


@router.get("/history")
def assessment_history(
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    rows = (
        db.query(Assessment)
        .filter(Assessment.userId == user.id, Assessment.status == "COMPLETED")
        .order_by(Assessment.completedAt.desc())
        .limit(20)
        .all()
    )

    def label_for(a: Assessment) -> str:
        if a.topicId:
            topic = db.query(Topic).filter(Topic.id == a.topicId).first()
            return topic.name if topic else "Topic quiz"
        if a.chapterId:
            chapter = db.query(Chapter).filter(Chapter.id == a.chapterId).first()
            return chapter.name if chapter else "Chapter test"
        return "Assessment"

    return {
        "assessments": [
            {
                "id": a.id, "type": a.type, "label": label_for(a),
                "score": a.score, "totalQuestions": a.totalQuestions,
                "completedAt": a.completedAt.isoformat() if a.completedAt else None,
            }
            for a in rows
        ]
    }
