from pydantic import BaseModel, Field

class TopicSeedItem(BaseModel):
    name: str
    order: int = Field(..., ge=0)
    durationM: int = Field(..., ge=1)
    prereqIds: list[str] = Field(default_factory=list)
    contentRef: str | None = None

class ChapterSeedItem(BaseModel):
    name: str
    order: int = Field(..., ge=0)
    topics: list[TopicSeedItem] = Field(default_factory=list)

class SubjectSeedItem(BaseModel):
    name: str
    chapters: list[ChapterSeedItem] = Field(default_factory=list)

class SubjectSeedRequest(BaseModel):
    grade: str
    subjects: list[SubjectSeedItem] = Field(default_factory=list)