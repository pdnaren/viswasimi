from typing import Optional
from pydantic import BaseModel, ConfigDict

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