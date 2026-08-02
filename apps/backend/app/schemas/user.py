from pydantic import BaseModel

class UpdateLocaleRequest(BaseModel):
    locale: str