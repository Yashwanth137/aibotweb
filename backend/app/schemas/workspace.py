from pydantic import BaseModel
from uuid import UUID
from datetime import datetime

class WorkspaceBase(BaseModel):
    name: str

class WorkspaceCreate(WorkspaceBase):
    pass

class WorkspaceResponse(WorkspaceBase):
    id: UUID
    user_id: UUID
    created_at: datetime

    class Config:
        from_attributes = True
