from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from app.models.message import MessageRole

class MessageBase(BaseModel):
    content: str
    role: MessageRole

class MessageCreate(MessageBase):
    chat_id: UUID

class MessageResponse(MessageBase):
    id: UUID
    chat_id: UUID
    created_at: datetime

    class Config:
        from_attributes = True
