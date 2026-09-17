from pydantic import BaseModel, Field, model_validator


class StartAssessmentRequest(BaseModel):
    topicId: str | None = None
    chapterId: str | None = None
    subjectId: str | None = None
    count: int = Field(default=5, ge=1, le=12)

    @model_validator(mode="after")
    def exactly_one_scope(self):
        scopes = [self.topicId, self.chapterId, self.subjectId]
        if sum(bool(s) for s in scopes) != 1:
            raise ValueError("Provide exactly one of topicId, chapterId, or subjectId")
        return self


class AnswerQuestionRequest(BaseModel):
    itemId: str
    selectedIndex: int = Field(..., ge=0)
