from pydantic import BaseModel, Field


class CreateParentLinkRequest(BaseModel):
    label: str | None = Field(default=None, max_length=50)
