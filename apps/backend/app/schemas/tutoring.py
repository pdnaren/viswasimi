from datetime import datetime
from enum import Enum
from pydantic import BaseModel, Field

class ChatRole(str, Enum):
    user = "user"
    assistant = "assistant"

class TutorMode(str, Enum):
    qa = "qa"
    guided = "guided"

class ChatHistoryItem(BaseModel):
    role: str  # keeping str (not Enum) to avoid breaking existing requests
    content: str

class ChatRequest(BaseModel):
    prompt: str
    topicId: str | None = None
    topicName: str | None = ""
    chapterId: str | None = ""
    chapterName: str | None = ""
    subjectName: str | None = ""
    history: list[ChatHistoryItem] = Field(default_factory=list)
    mode: str = "qa"
    current_chunk_index: int = Field(default=0, ge=0)

class ChatSavePayload(BaseModel):
    topicId: str
    role: str
    content: str
    createdAt: datetime | None = None

class TTSRequest(BaseModel):
    text: str

class CheckpointGradeRequest(BaseModel):
    topicId: str
    question: str
    answer: str

class PlanItemRequest(BaseModel):
    topicId: str
    startsAt: datetime
    endsAt: datetime
    targetMastery: int = Field(default=3, ge=1, le=5)