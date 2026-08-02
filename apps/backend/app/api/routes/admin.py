import os
import uuid
import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Query, UploadFile, File, Form
from sqlalchemy.orm import Session as DBSession

from app.api.dependencies import get_db, get_current_user
from app.models.user import User
from app.models.curriculum import Subject, Chapter, Topic
from app.schemas.curriculum import SubjectSeedRequest

router = APIRouter()

INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY")
RAG_BACKEND_URL = os.getenv("RAG_BACKEND_URL", "http://localhost:8001")

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
    file_bytes = await file.read()
    
    async with httpx.AsyncClient(timeout=300.0) as client:
        res = await client.post(
            f"{RAG_BACKEND_URL}/api/ingest",
            headers={"X-Internal-Key": INTERNAL_API_KEY}, 
            data={
                "grade": grade, 
                "subject": subject, 
                "chapterId": chapterId, 
                "topicId": topicId
            },
            files={"file": (file.filename, file_bytes, file.content_type)}
        )

    if res.status_code != 200:
        raise HTTPException(status_code=res.status_code, detail=res.text)

    return res.json()