import json
import re
import logging
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import text
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_openai import ChatOpenAI

from app.api.dependencies import require_internal_key
from app.core.llm import tutor_llm, utility_llm
from app.db.vector_store import engine, vector_store
from app.schemas.payload import AskRequest

logger = logging.getLogger(__name__)
router = APIRouter()


def choose_model(query: str, mode: str = "qa") -> ChatOpenAI:
    if mode.lower() == "guided":
        return tutor_llm
    simple = ["define", "what is", "meaning", "hello", "hi", "thanks", "tell me about", "who is", "when did"]
    if any(query.lower().startswith(k) for k in simple) and len(query) < 100:
        return utility_llm
    return tutor_llm


@router.post("/ask")
async def ask_question(
    payload: AskRequest,
    _: None = Depends(require_internal_key),
):
    try:
        context_text = ""
        image_trailer_text = ""
        user_query = (
            (payload.query or payload.prompt or "").strip()
            or "Please teach me this section."
        )
        is_next_btn = (
            payload.mode.strip().lower() == "guided"
            and "I am ready" in user_query
        )

        # ── GUIDED MODE ──────────────────────────────────────────────────────
        if payload.mode.strip().lower() == "guided":
            with engine.connect() as conn:
                row = conn.execute(
                    text("""
                        SELECT document, cmetadata
                        FROM   langchain_pg_embedding
                        WHERE  (
                                  cmetadata->>'topicId' = :tid
                                  OR (
                                    :tname <> ''
                                    AND cmetadata->>'topicId' = :tname
                                  )
                               )
                          AND  CAST(cmetadata->>'chunk_index' AS INTEGER) = :cidx
                        LIMIT  1
                    """),
                    {
                        "tid": payload.topicId,
                        "tname": payload.topicName,
                        "cidx": payload.current_chunk_index,
                    },
                ).fetchone()

            if not row:
                if payload.current_chunk_index == 0:
                    async def missing_content_stream():
                        msg = (
                            "I could not find the textbook chunks for this topic yet. "
                            "Please re-ingest this PDF from the Admin Panel, then restart the lesson."
                        )
                        yield f"data: {json.dumps({'choices': [{'delta': {'content': msg}}]})}\n\n"
                        yield "data: [DONE]\n\n"
                    return StreamingResponse(missing_content_stream(), media_type="text/event-stream")

                async def end_stream():
                    yield f"data: {json.dumps({'choices': [{'delta': {'content': '[TOPIC_COMPLETED]'}}]})}\n\n"
                    yield "data: [DONE]\n\n"
                return StreamingResponse(end_stream(), media_type="text/event-stream")

            doc_text = row[0]
            metadata = row[1] if isinstance(row[1], dict) else json.loads(row[1])
            context_text = f"\n---\n{doc_text}\n"

            section_images = []
            for image_url in metadata.get("images", []) or []:
                clean_url = image_url.replace("\n", "").replace("\r", "").strip()
                if clean_url and clean_url not in section_images:
                    section_images.append(clean_url)
            if section_images:
                image_trailer_text = (
                    "\n\n".join(f"![Page visual]({u})" for u in section_images) + "\n\n"
                )
                context_text += (
                    "\n\nPAGE_IMAGES_ALREADY_DISPLAYED:\n"
                    + "\n".join(section_images)
                    + "\n"
                )

            section_heading = metadata.get("heading", "this page")
            page_num = metadata.get("page_start", "?")
            chunk_index = metadata.get("chunk_index", payload.current_chunk_index)
            should_teach_page = (
                is_next_btn
                or "teach" in user_query.lower()
                or "resume" in user_query.lower()
                or not payload.history
            )

            if should_teach_page:
                checkpoint_instruction = (
                    "6. After teaching, ask EXACTLY ONE comprehension question "
                    "inside tags: [CHECKPOINT]Your question here?[/CHECKPOINT]\n"
                    "   The question must test understanding of this section's "
                    "content. Make it specific and thought-provoking."
                )
                checkpoint_rule = "- The [CHECKPOINT] tag is MANDATORY."
            else:
                checkpoint_instruction = (
                    "6. The student is answering or asking a follow-up. "
                    "Respond helpfully without a new checkpoint question."
                )
                checkpoint_rule = "- DO NOT include [CHECKPOINT] tags."

            sys_msg = (
                f"You are Viswasimi, an expert AI tutor teaching grade "
                f"{payload.grade} {payload.subject}: {payload.topicName}.\n"
                f"CRITICAL: Respond entirely in {payload.language}.\n\n"
                f"CURRENT_PAGE_CONTEXT: chunk {chunk_index}, page {page_num}, "
                f"heading '{section_heading}'.\n"
                "Teach ONLY this current PDF page. Do not include content from previous or next pages.\n\n"
                "MATH FORMATTING: Use $...$ for inline math, $$...$$ for block equations. "
                "Never use \\[ \\] or \\( \\) delimiters.\n\n"
                "YOUR TASKS:\n"
                "1. Read the context carefully and teach it step by step in the same order as this page.\n"
                "2. Do not skip named quantities, units, symbols, formulas, figure references, or table rows that appear in the context.\n"
                "3. If the context contains a table, reproduce it as a FULL Markdown table (same rows, "
                "columns and header — do not summarize it away) and then explain what each row means.\n"
                "4. If the context mentions a figure or diagram, explain what the context says about it.\n"
                "5. Keep total response under 1200 words, but prefer complete coverage over a short summary.\n"
                f"{checkpoint_instruction}\n\n"
                "RULES:\n"
                "- Use ONLY the provided context.\n"
                "- Do not invent examples, formulas, or image descriptions not in the context.\n"
                "- Do not output markdown image tags.\n"
                f"{checkpoint_rule}\n\n"
                "Context:\n{{context}}"
            )

        # ── QA MODE ──────────────────────────────────────────────────────────
        else:
            docs = vector_store.similarity_search(
                query=user_query, k=6, filter={"topicId": payload.topicId}
            )
            if not docs and payload.topicName and payload.topicName != payload.topicId:
                docs = vector_store.similarity_search(
                    query=user_query, k=6, filter={"topicId": payload.topicName}
                )

            # Collect every image referenced by the retrieved chunks so they can be
            # appended deterministically after the response (see note below on why
            # inline image tags from the LLM itself are unreliable).
            qa_images: list[str] = []
            for d in docs:
                context_text += f"\n---\n{d.page_content}\n"
                for u in d.metadata.get("images", []) or []:
                    clean = u.replace("\n", "").replace("\r", "").strip()
                    if clean and clean not in qa_images:
                        qa_images.append(clean)

            if qa_images:
                context_text += (
                    "\n\nRELATED_DIAGRAMS: this section has diagrams available "
                    "(shown to the student automatically after your answer — do not "
                    "invent your own image links, just refer to them in words, e.g. "
                    "'as shown in the diagram below').\n"
                )
                image_trailer_text = (
                    "\n\n".join(f"![Diagram]({u})" for u in qa_images) + "\n\n"
                )

            sys_msg = (
                f"You are Viswasimi, an expert AI tutor.\n"
                f"CRITICAL: Respond entirely in {payload.language}.\n\n"
                "MATH FORMATTING: Use $...$ for inline math, $$...$$ for block equations.\n\n"
                "RULES:\n"
                "1. Answer using ONLY the provided context in simple language.\n"
                "2. TABLE RULE: If the student asks to see a table, reproduce the FULL Markdown table "
                "from the context exactly (same rows, columns and header), not a paraphrase.\n"
                "3. Answer in 1–3 paragraphs. No [CHECKPOINT] tags in QA mode.\n\n"
                "Context:\n{{context}}"
            )

        # ── Build and stream the LangChain chain ─────────────────────────────
        messages = [("system", sys_msg)]

        if is_next_btn:
            user_query = "Teach me this section thoroughly and end with a [CHECKPOINT] comprehension question."
        else:
            for msg in payload.history[-6:]:
                role = msg.get("role", "user") if isinstance(msg, dict) else getattr(msg, "role", "user")
                content = msg.get("content", "") if isinstance(msg, dict) else getattr(msg, "content", "")
                safe_content = content.replace("{", "{{").replace("}", "}}")
                lc_role = "assistant" if role == "assistant" else "user"
                messages.append((lc_role, safe_content))

        messages.append(("user", "{query}"))

        prompt = ChatPromptTemplate.from_messages(messages)
        llm = choose_model(user_query, payload.mode)
        chain = prompt | llm | StrOutputParser()

        async def stream():
            try:
                buffer = ""
                async for chunk in chain.astream({
                    "context": context_text,
                    "query": user_query,
                }):
                    if not chunk:
                        continue
                    buffer += chunk
                    buffer = (
                        buffer
                        .replace("] (", "](")
                        .replace("]\n(", "](")
                        .replace("\n)", ")")
                        .replace("http\n", "http")
                        .replace("https\n", "https")
                    )

                    if "![" in buffer:
                        img_start = buffer.find("![")
                        paren_open = buffer.find("(", img_start)
                        if paren_open == -1:
                            continue
                        paren_close = buffer.find(")", paren_open)
                        if paren_close == -1:
                            continue
                        buffer = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", buffer)
                        if not buffer.strip():
                            buffer = ""
                            continue

                    yield "data: " + json.dumps({"choices": [{"delta": {"content": buffer}}]}) + "\n\n"
                    buffer = ""

                if buffer:
                    yield "data: " + json.dumps({"choices": [{"delta": {"content": buffer}}]}) + "\n\n"

                if image_trailer_text:
                    yield "data: " + json.dumps({"choices": [{"delta": {"content": "\n\n" + image_trailer_text}}]}) + "\n\n"

                yield "data: [DONE]\n\n"

            except Exception as exc:
                logger.exception("Streaming error")
                yield "data: " + json.dumps({"choices": [{"delta": {"content": f"\n⚠️ Streaming error: {str(exc)}"}}]}) + "\n\n"
                yield "data: [DONE]\n\n"

        return StreamingResponse(stream(), media_type="text/event-stream")

    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Ask error: {exc}", exc_info=True)
        raise HTTPException(500, "An error occurred. Please try again.")