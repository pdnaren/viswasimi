from enum import Enum
from pydantic import BaseModel, Field

class ProgressEvent(str, Enum):
    STARTED = "STARTED"
    CHECKPOINT = "CHECKPOINT"
    COMPLETED = "COMPLETED"
    REVISED = "REVISED"
    QUIZ_PASSED = "QUIZ_PASSED"
    QUIZ_FAILED = "QUIZ_FAILED"

class ProgressRequest(BaseModel):
    topicId: str
    event: str
    score: float | None = Field(default=None, ge=0, le=100)
    seconds: int = Field(default=0, ge=0)

class ProgressLogRequest(BaseModel):
    topicId: str
    event: str
    score: float = Field(default=0, ge=0, le=100)
    seconds: int = Field(default=0, ge=0)

class DailyUpdateRequest(BaseModel):
    topicsCompleted: int = Field(default=0, ge=0)
    minutes: int = Field(default=0, ge=0)

class MasteryUpdateRequest(BaseModel):
    topicId: str
    increment: int = Field(default=1, ge=1, le=5)