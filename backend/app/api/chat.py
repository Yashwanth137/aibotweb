from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from typing import List, Optional
from uuid import UUID
import logging
from app.core.database import get_db
from app.models.chat import Chat
from app.models.workspace import Workspace
from app.models.user import User
from app.schemas.chat import ChatCreate, ChatResponse
from app.dependencies import get_current_user

router = APIRouter(prefix="/chats", tags=["chats"])
logger = logging.getLogger(__name__)

@router.post("/", response_model=ChatResponse)
async def create_chat(
    chat_in: ChatCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Verify workspace ownership
    query = select(Workspace).where(
        Workspace.id == chat_in.workspace_id,
        Workspace.user_id == current_user.id
    )
    result = await db.execute(query)
    workspace = result.scalar_one_or_none()
    
    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found or access denied"
        )
    
    new_chat = Chat(
        title=chat_in.title,
        workspace_id=chat_in.workspace_id
    )
    db.add(new_chat)
    await db.commit()
    await db.refresh(new_chat)
    return new_chat

@router.get("/", response_model=List[ChatResponse])
async def list_chats(
    workspace_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Verify workspace ownership first
    query_ws = select(Workspace).where(
        Workspace.id == workspace_id,
        Workspace.user_id == current_user.id
    )
    result_ws = await db.execute(query_ws)
    workspace = result_ws.scalar_one_or_none()
    
    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found or access denied"
        )

    # Fetch chats
    query = select(Chat).where(Chat.workspace_id == workspace_id).order_by(Chat.created_at.desc())
    result = await db.execute(query)
    chats = result.scalars().all()
    return chats

@router.delete("/{chat_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_chat(
    chat_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Verify ownership
    query = select(Chat).join(Workspace).where(
        Chat.id == chat_id,
        Workspace.user_id == current_user.id
    )
    result = await db.execute(query)
    chat = result.scalar_one_or_none()
    
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
        
    # Delete 
    await db.execute(delete(Message).where(Message.chat_id == chat_id))
    await db.execute(delete(Chat).where(Chat.id == chat_id))
    await db.commit()

@router.post("/{chat_id}/clear")
async def clear_chat(
    chat_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(Chat).join(Workspace).where(
        Chat.id == chat_id,
        Workspace.user_id == current_user.id
    )
    result = await db.execute(query)
    chat = result.scalar_one_or_none()
    
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
        
    await db.execute(delete(Message).where(Message.chat_id == chat_id))
    await db.commit()
    return {"status": "success"}

# --- Streaming Implementation ---

from fastapi.responses import StreamingResponse
from app.schemas.chat import ChatStreamRequest
from app.models.message import Message, MessageRole
from app.core.config import settings
import httpx
import json

# Constants
MODEL = "meta-llama/llama-3.1-8b-instruct"
MAX_TOKENS = 1000
HISTORY_LIMIT = 10

@router.post("/stream", response_class=StreamingResponse)
async def stream_chat(
    request: ChatStreamRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # 1. Verify chat existence and workspace ownership
    
    query = select(Chat).join(Workspace).where(
        Chat.id == request.chat_id,
        Workspace.user_id == current_user.id
    )
    result = await db.execute(query)
    chat = result.scalar_one_or_none()

    if not chat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat not found or access denied"
        )

    # 2. Persist User Message
    user_msg = Message(
        chat_id=chat.id,
        role=MessageRole.USER,
        content=request.message
    )
    db.add(user_msg)
    await db.commit()
    
    # 3. Fetch recent history for context
    # Get last N messages
    history_query = select(Message).where(
        Message.chat_id == chat.id
    ).order_by(Message.created_at.desc()).limit(HISTORY_LIMIT)
    
    history_result = await db.execute(history_query)
    # Reverse to chronological order
    recent_messages = sorted(history_result.scalars().all(), key=lambda x: x.created_at)
    
    # Prune history to avoid token limits (Safe estimate: 4 chars ~= 1 token)
    # Target: ~3000 tokens context => ~12000 chars
    MAX_INPUT_CHARS = 12000
    current_chars = 0
    pruned_messages = []
    
    # Process from newest to oldest
    for msg in reversed(recent_messages):
        msg_len = len(msg.content)
        if current_chars + msg_len > MAX_INPUT_CHARS:
            break
        pruned_messages.append(msg)
        current_chars += msg_len
        
    # Restore chronological order
    pruned_messages.reverse()
    
    # Format for OpenRouter
    messages_payload = [
        {"role": msg.role, "content": msg.content} for msg in pruned_messages
    ]
    
    # 4. Stream Generator
    async def generate():
        full_response = []
        headers = {
            "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:8000", 
            "X-Title": settings.PROJECT_NAME,
        }
        data = {
            "model": MODEL,
            "messages": messages_payload,
            "stream": True,
            "max_tokens": MAX_TOKENS
        }
        
        async with httpx.AsyncClient() as client:
            try:
                async with client.stream("POST", "https://openrouter.ai/api/v1/chat/completions", headers=headers, json=data) as response:
                    if response.status_code != 200:
                        yield f"Error: {response.status_code}".encode('utf-8')
                        return

                    async for line in response.aiter_lines():
                        if line.startswith("data: "):
                            line_content = line[6:]
                            if line_content == "[DONE]":
                                break
                            try:
                                chunk = json.loads(line_content)
                                if chunk["choices"]:
                                    delta = chunk["choices"][0]["delta"]
                                    content = delta.get("content", "")
                                    if content:
                                        full_response.append(content)
                                        yield content.encode('utf-8')
                            except json.JSONDecodeError:
                                continue
            except Exception as e:
                yield f"Stream Error: {str(e)}".encode('utf-8')
            
            # 5. Persist Assistant Message (Accumulated)
            text_content = "".join(full_response)
            if text_content:
                try:
                    asst_msg = Message(
                        chat_id=chat.id,
                        role=MessageRole.ASSISTANT,
                        content=text_content
                    )
                    db.add(asst_msg)
                    await db.commit()
                except Exception as e:
                    # In a real app, log this error
                    logger.error(f"Failed to save assistant message: {e}")

    return StreamingResponse(generate(), media_type="text/plain")

from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
import asyncio
import tavily_client

# --- RAG Implementation ---

def get_tavily_context(query: str) -> Optional[str]:
    """
    Fetches context from Tavily, normalizes it, and returns a single formatted string.
    Returns None if search fails or no results found.
    """
    try:
        logger.info(f"Fetching Tavily context for: {query}")
        results = tavily_client.search(
            query,
            max_results=3,
            api_key=settings.TAVILY_API_KEY
        )
        if not results:
            logger.warning("Tavily returned no results.")
            return None
        
        # Normalize: Pick top 3.
        lines = []
        for i, r in enumerate(results, 1):
             title = r.get("title", "Untitled")
             content = r.get("snippet", "")
             source = r.get("url", "Unknown")
             date = r.get("date", "Unknown Date")
             
             # Shorten content to avoid context overflow/bloat
             if len(content) > 400:
                 content = content[:397] + "..."
                 
             lines.append(f"{title} ({date})\n{content}")
             
        context_str = "\n\n".join(lines)
        # logger.debug(f"Context found ({len(context_str)} chars)")
        return context_str
        
    except Exception as e:
        logger.error(f"Error in get_tavily_context: {e}")
        return None

@router.post("/agent/stream", response_class=StreamingResponse)
async def stream_agent_chat(
    request: ChatStreamRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # 1. Verify workspace/chat
    query = select(Chat).join(Workspace).where(
        Chat.id == request.chat_id,
        Workspace.user_id == current_user.id
    )
    result = await db.execute(query)
    chat = result.scalar_one_or_none()

    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    # 2. Persist User Message
    user_msg = Message(
        chat_id=chat.id,
        role=MessageRole.USER,
        content=request.message
    )
    db.add(user_msg)
    
    # Auto-Rename if first message
    if chat.title == "New Chat":
        try:
             # Summarize
             llm_title = ChatOpenAI(
                api_key=settings.OPENROUTER_API_KEY,
                base_url="https://openrouter.ai/api/v1",
                model="meta-llama/llama-3.1-8b-instruct",
                temperature=0,
                max_tokens=15
             )
             # Basic prompt
             title_resp = await llm_title.ainvoke(
                 [HumanMessage(content=f"Summarize this in 3-5 words for a chat title: {request.message}")]
             )
             new_title = title_resp.content.strip().replace('"', '')
             if new_title:
                 chat.title = new_title
                 db.add(chat) 
        except Exception as e:
             logger.error(f"Auto-rename failed: {e}")

    await db.commit()

    # 3. RAG Pipeline Generator
    async def generate_rag_stream():
        final_answer = ""
        cancelled = False

        try:
            # 1. Fetch search context (blocking moved off event loop)
            loop = asyncio.get_running_loop()
            context = await loop.run_in_executor(
                None, get_tavily_context, request.message
            )

            # 2. If search failed completely → honest failure
            if not context or not context.strip():
                msg = (
                    "I couldn’t find any relevant results from live search "
                    "for this query."
                )
                yield msg.encode("utf-8")
                final_answer = msg
                return

            # 3. Reporting-style system prompt
            system_prompt = (
                "You are an AI assistant that reports what live search results indicate. "
                "Summarize the information clearly and concisely. "
                "If sources disagree, mention the variation. "
                "Do not add facts beyond the provided information. "
                "Do not mention sources, URLs, or internal search context."
            )

            full_prompt = [
                SystemMessage(content=system_prompt),
                HumanMessage(
                    content=f"Search results:\n{context}\n\nUser question: {request.message}"
                )
            ]

            # 4. Stream summarized answer
            llm = ChatOpenAI(
                api_key=settings.OPENROUTER_API_KEY,
                base_url="https://openrouter.ai/api/v1",
                model=MODEL,
                streaming=True,
                temperature=0
            )

            async for chunk in llm.astream(full_prompt):
                if chunk.content:
                    final_answer += chunk.content
                    yield chunk.content.encode("utf-8")

        except asyncio.CancelledError:
            logger.info("Search-reporting stream cancelled")
            cancelled = True

        except Exception as e:
            logger.error(f"Search-reporting agent error: {e}")
            err = "An error occurred while fetching or summarizing search results."
            yield err.encode("utf-8")
            final_answer = err

        # 5. Persist assistant message
        if final_answer and not cancelled:
            try:
                asst_msg = Message(
                    chat_id=chat.id,
                    role=MessageRole.ASSISTANT,
                    content=final_answer
                )
                db.add(asst_msg)
                await db.commit()
            except Exception as e:
                logger.error(f"Failed to save assistant message: {e}")

    return StreamingResponse(generate_rag_stream(), media_type="text/plain")
