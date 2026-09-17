import json
import logging
import re

from fastapi import APIRouter, Depends

from app.api.dependencies import require_internal_key
from app.core.llm import utility_llm
from app.db.vector_store import vector_store
from app.schemas.payload import QuizGenerateRequest, QuizGenerateResponse, QuizQuestion

logger = logging.getLogger(__name__)
router = APIRouter()


def _retrieve_context(topic_id: str, topic_name: str) -> str:
    docs = vector_store.similarity_search(query=topic_name or topic_id, k=8, filter={"topicId": topic_id})
    if not docs and topic_name and topic_name != topic_id:
        docs = vector_store.similarity_search(query=topic_name, k=8, filter={"topicId": topic_name})
    return "\n---\n".join(d.page_content for d in docs)


def _parse_questions(raw: str) -> list[dict]:
    cleaned = raw.strip()
    cleaned = re.sub(r"^```(json)?", "", cleaned).strip()
    cleaned = re.sub(r"```$", "", cleaned).strip()
    try:
        data = json.loads(cleaned)
    except ValueError:
        logger.warning("Quiz generation returned non-JSON output: %s", raw[:300])
        return []

    items = data if isinstance(data, list) else data.get("questions", [])
    questions = []
    for item in items:
        options = item.get("options")
        correct_index = item.get("correctIndex")
        prompt = item.get("prompt")
        if not prompt or not isinstance(options, list) or len(options) < 2:
            continue
        if not isinstance(correct_index, int) or not (0 <= correct_index < len(options)):
            continue
        questions.append({
            "prompt": prompt,
            "options": options,
            "correctIndex": correct_index,
            "explanation": item.get("explanation") or "",
        })
    return questions


@router.post("/generate-quiz", response_model=QuizGenerateResponse)
async def generate_quiz(
    payload: QuizGenerateRequest,
    _: None = Depends(require_internal_key),
):
    context = _retrieve_context(payload.topicId, payload.topicName)
    if not context.strip():
        return QuizGenerateResponse(questions=[])

    count = max(1, min(payload.count, 10))
    sys_msg = (
        f"You are a strict exam-question writer for grade {payload.grade} {payload.subject}, "
        f"topic '{payload.topicName}'.\n"
        f"Write EXACTLY {count} multiple-choice questions grounded ONLY in the context below. "
        "Do not invent facts not present in the context.\n"
        f"Respond in {payload.language}.\n\n"
        "Output STRICT JSON only — a single JSON array, no markdown fences, no commentary — "
        "in this exact shape:\n"
        '[{"prompt": "...", "options": ["...", "...", "...", "..."], '
        '"correctIndex": 0, "explanation": "..."}]\n\n'
        "Rules:\n"
        "- Each question has exactly 4 options.\n"
        "- correctIndex is the 0-based index of the single correct option.\n"
        "- explanation is one short sentence citing why the correct option is right.\n"
        "- Vary difficulty and avoid duplicate questions.\n\n"
        f"Context:\n{context}"
    )

    try:
        response = await utility_llm.ainvoke(sys_msg)
        raw = response.content if hasattr(response, "content") else str(response)
    except Exception:
        logger.exception("Quiz generation LLM call failed")
        return QuizGenerateResponse(questions=[])

    questions = _parse_questions(raw)[:count]
    return QuizGenerateResponse(questions=[QuizQuestion(**q) for q in questions])
