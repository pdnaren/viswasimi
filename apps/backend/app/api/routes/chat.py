import uuid
import json
import logging
import httpx
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Request, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session as DBSession
from sqlalchemy import func
from openai import AsyncOpenAI

from app.api.dependencies import get_db, get_current_user, get_active_subscription, _to_naive_utc, now_utc, IST
from app.core.config import settings
from app.core.rate_limit import limiter
from app.models.user import User
from app.models.tutoring import ChatMessage
from app.models.progress import Progress
from app.schemas.tutoring import ChatRequest, ChatSavePayload, CheckpointGradeRequest

logger = logging.getLogger(__name__)
router = APIRouter()

openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

async def evaluate_answer_accuracy(history: list, user_message: str) -> int | None:
    if not history:
        return None

    last_ai_msg = next((m.content for m in reversed(history) if m.role == "assistant"), None)
    if not last_ai_msg or "?" not in last_ai_msg:
        return None

    logistical_phrases = ["ready", "proceed", "shall we", "clear so far", "understand", "next section", "move on", "continue"]
    if any(phrase in last_ai_msg.lower() for phrase in logistical_phrases):
        return None

    try:
        grading_prompt = (
            "You are a strict but fair grading assistant for a student tutor app.\n"
            "Your job: decide if the student answered the AI tutor's question correctly.\n\n"
            f'AI Tutor\'s Question: "{last_ai_msg}"\n'
            f'Student\'s Answer: "{user_message}"\n\n'
            "Rules:\n"
            "- If the student's answer is correct or substantially correct: reply with exactly the word CORRECT\n"
            "- If the student's answer is wrong or incomplete: reply with exactly the word INCORRECT\n"
            "- If the question was a greeting, transition, or not a knowledge-check: reply with exactly the word NA\n"
            "Reply with ONLY one word: CORRECT, INCORRECT, or NA. No punctuation, no explanation."
        )

        response = await openai_client.chat.completions.create(
            model="gpt-4o-mini", max_tokens=5, temperature=0,
            messages=[{"role": "user", "content": grading_prompt}],
        )

        result = response.choices[0].message.content.strip().upper()
        if result == "CORRECT": return 100
        elif result == "INCORRECT": return 0
        else: return None
    except Exception as e:
        logger.error(f"Grading Error: {e}")
        return None


@router.post("/grade")
@limiter.limit("60/minute")
async def grade_checkpoint(
    request: Request,
    payload: CheckpointGradeRequest,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    grading_prompt = (
        "You are a strict but fair grading assistant for a student tutor app.\n"
        "Decide whether the student answered the tutor's question correctly.\n\n"
        f'Question: "{payload.question}"\n'
        f'Student answer: "{payload.answer}"\n\n'
        "Reply with EXACTLY one word — CORRECT, INCORRECT, or NA.\n"
        "NA means the question is not a knowledge-check (greeting, transition, etc.).\n"
        "No punctuation. No explanation."
    )

    score: int | None = None
    try:
        resp = await openai_client.chat.completions.create(
            model="gpt-4o-mini", max_tokens=5, temperature=0,
            messages=[{"role": "user", "content": grading_prompt}],
        )
        result = resp.choices[0].message.content.strip().upper()
        if result == "CORRECT":   score = 100
        elif result == "INCORRECT": score = 0
    except Exception as e:
        logger.error(f"Grading error: {e}")

    if score is not None:
        db.add(Progress(
            id=f"prog_{uuid.uuid4().hex}",
            userId=user.id, topicId=payload.topicId,
            event="CHECKPOINT", score=float(score),
            ts=_to_naive_utc(now_utc()),
        ))
        db.commit()

    return {"graded": score is not None, "correct": score == 100 if score is not None else None, "score": score}


@router.post("/respond")
@limiter.limit("30/minute")
async def chat_respond(
    request: Request,
    payload: ChatRequest,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    subscription = get_active_subscription(user.id, db)
    is_basic = subscription and subscription.plan and subscription.plan.name != "free"

    if not is_basic:
        # Reset the daily quota at IST midnight, not UTC midnight — the product
        # targets Indian students, so a UTC boundary would reset mid-morning IST.
        ist_today_start = datetime.now(IST).replace(hour=0, minute=0, second=0, microsecond=0)
        day_start_utc = _to_naive_utc(ist_today_start.astimezone(timezone.utc))
        sent_today_count = (
            db.query(func.count(ChatMessage.id))
            .filter(ChatMessage.userId == user.id, ChatMessage.role == "user", ChatMessage.createdAt >= day_start_utc)
            .scalar()
        )
        if sent_today_count >= 10:
            raise HTTPException(403, "Daily limit reached. Free users are limited to 10 messages per day. Please upgrade!")

    if not payload.topicId:
        raise HTTPException(400, "Please select a topic from the curriculum to start learning.")

    checkpoint_score = None
    if payload.history and payload.prompt:
        auto_prompts = ["I am ready", "I am back"]
        if not any(phrase in payload.prompt for phrase in auto_prompts):
            score = await evaluate_answer_accuracy(payload.history, payload.prompt)
            if score is not None:
                checkpoint_score = score
                db.add(Progress(
                    id=f"prog_{uuid.uuid4().hex}", userId=user.id, topicId=payload.topicId,
                    event="CHECKPOINT", score=float(score), ts=_to_naive_utc(now_utc()),
                ))
                db.commit()

    if checkpoint_score == 100:
        async def correct_answer_stream():
            msg = "Correct. You can continue to the next section when you are ready."
            yield f"data: {json.dumps({'choices': [{'delta': {'content': msg}}]})}\n\n"
            yield "data: [DONE]\n\n"
        return StreamingResponse(correct_answer_stream(), media_type="text/event-stream")

    is_initial_teaching = not payload.prompt or payload.prompt.strip() == ""
    if is_initial_teaching:
        rag_query = (
            f"Please explain the topic '{payload.topicName}' step-by-step. "
            "Start with a welcoming introduction, teach the first core concept, "
            "and then ask a quick question to check my understanding."
        )
    else:
        rag_query = payload.prompt
        if checkpoint_score == 0:
            rag_query = (
                "The student's answer to the last checkpoint was incorrect. "
                "Explain the correct answer in very simple words using only the current context. "
                "Do not ask a new checkpoint question yet. Student answer: "
                f"{payload.prompt}"
            )

    language_map = {"en-IN": "English", "hi-IN": "Hindi", "ta-IN": "Tamil", "te-IN": "Telugu"}
    
    def truncate_history(history: list, max_msgs: int = 10, max_chars: int = 500) -> list:
        recent = history[-max_msgs:]
        truncated = []
        for msg in recent:
            content = getattr(msg, 'content', '')
            role = getattr(msg, 'role', 'user')
            if len(content) > max_chars:
                content = content[:max_chars] + "… [truncated]"
            truncated.append({"role": role, "content": content})
        return truncated

    rag_payload = {
        "query": rag_query, "grade": user.grade, "subject": payload.subjectName,
        "chapterId": payload.chapterId, "topicId": payload.topicId,
        "topicName": payload.topicName, "chapterName": payload.chapterName,
        "subjectName": payload.subjectName, "history": truncate_history(payload.history),
        "mode": getattr(payload, "mode", "qa"), "current_chunk_index": getattr(payload, "current_chunk_index", 0),
        "language": language_map.get(user.locale, "English"),
    }

    rag_headers = {"Content-Type": "application/json", "X-Internal-Key": settings.INTERNAL_API_KEY}

    async def stream_proxy():
        error_msg = {"choices": [{"delta": {"content": "I'm having trouble connecting to my knowledge base right now."}}]}
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                async with client.stream("POST", f"{settings.RAG_BACKEND_URL}/api/ask", json=rag_payload, headers=rag_headers) as response:
                    if response.status_code >= 400:
                        yield f"data: {json.dumps(error_msg)}\n\n"
                        yield "data: [DONE]\n\n"
                        return
                    async for chunk in response.aiter_bytes():
                        yield chunk
        except httpx.HTTPError as exc:
            logger.error(f"RAG backend request failed: {exc}")
            yield f"data: {json.dumps(error_msg)}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(stream_proxy(), media_type="text/event-stream")


@router.post("/save")
def save_chat_message(
    payload: ChatSavePayload,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    db.add(ChatMessage(userId=user.id, topicId=payload.topicId, role=payload.role, content=payload.content))
    db.commit()
    return {"ok": True, "message": "Message saved successfully"}


@router.get("/history")
def get_chat_history(
    topicId: str,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.userId == user.id, ChatMessage.topicId == topicId)
        .order_by(ChatMessage.createdAt.desc())
        .limit(30)
        .all()
    )
    return {
        "messages": [
            {"id": msg.id, "role": msg.role, "content": msg.content, "createdAt": msg.createdAt.isoformat() if msg.createdAt else None}
            for msg in reversed(messages)
        ]
    }