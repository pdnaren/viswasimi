from pydantic import BaseModel, Field, model_validator


class StartAssessmentRequest(BaseModel):
    topicId: str | None = None
    chapterId: str | None = None
    count: int = Field(default=5, ge=1, le=10)

    @model_validator(mode="after")
    def exactly_one_scope(self):
        if bool(self.topicId) == bool(self.chapterId):
            raise ValueError("Provide exactly one of topicId or chapterId")
        return self


class AnswerQuestionRequest(BaseModel):
    itemId: str
    selectedIndex: int = Field(..., ge=0)
