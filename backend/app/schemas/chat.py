from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Optional

class ChatBase(BaseModel):
    title: Optional[str] = None
    workspace_id: UUID

class ChatCreate(ChatBase):
    pass

class ChatResponse(ChatBase):
    id: UUID
    created_at: datetime
    title: Optional[str]

    class Config:
        from_attributes = True

class ChatStreamRequest(BaseModel):
    chat_id: UUID
    message: str
