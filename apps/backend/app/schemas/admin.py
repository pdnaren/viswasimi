from pydantic import BaseModel, Field


class OverrideSubscriptionRequest(BaseModel):
    planName: str = Field(..., min_length=1)
    days: int | None = Field(default=None, ge=1, le=3650)
