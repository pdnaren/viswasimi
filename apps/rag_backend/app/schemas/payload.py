from typing import Optional
from pydantic import BaseModel, ConfigDict, Field

class AskRequest(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)
    query: Optional[str] = None
    prompt: Optional[str] = None
    grade: Optional[str] = ""
    subject: Optional[str] = ""
    chapterId: Optional[str] = ""
    topicId: Optional[str] = ""
    topicName: str = ""
    chapterName: str = ""
    subjectName: str = ""
    history: list = []
    mode: str = "qa"
    current_chunk_index: int = 0
    language: str = "English"

class QuizGenerateRequest(BaseModel):
    topicId: str
    topicName: str = ""
    subject: str = ""
    grade: str = ""
    count: int = Field(default=5, ge=1, le=10)
    language: str = "English"

class QuizQuestion(BaseModel):
    prompt: str
    options: list[str]
    correctIndex: int
    explanation: str = ""

class QuizGenerateResponse(BaseModel):
    questions: list[QuizQuestion]