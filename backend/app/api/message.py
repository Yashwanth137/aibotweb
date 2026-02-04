from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from uuid import UUID
from app.core.database import get_db
from app.models.message import Message
from app.models.chat import Chat
from app.models.workspace import Workspace
from app.schemas.message import MessageCreate, MessageResponse
from app.dependencies import get_current_user
from app.models.user import User

router = APIRouter(prefix="/messages", tags=["messages"])

async def verify_chat_access(chat_id: UUID, user_id: UUID, db: AsyncSession):
    # Join Chat -> Workspace to verify User ownership
    query = select(Chat).join(Workspace).where(
        Chat.id == chat_id,
        Workspace.user_id == user_id
    )
    result = await db.execute(query)
    chat = result.scalar_one_or_none()
    if not chat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat not found or access denied"
        )
    return chat

@router.post("/", response_model=MessageResponse)
async def create_message(
    message_in: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    await verify_chat_access(message_in.chat_id, current_user.id, db)
    
    new_message = Message(
        chat_id=message_in.chat_id,
        role=message_in.role,
        content=message_in.content
    )
    db.add(new_message)
    await db.commit()
    await db.refresh(new_message)
    return new_message

@router.get("/", response_model=List[MessageResponse])
async def list_messages(
    chat_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    await verify_chat_access(chat_id, current_user.id, db)
    
    query = select(Message).where(Message.chat_id == chat_id).order_by(Message.created_at.asc())
    result = await db.execute(query)
    messages = result.scalars().all()
    return messages
