from fastapi import FastAPI
from app.api import auth, workspace, chat, message
from app.core.config import settings

app = FastAPI(title=settings.PROJECT_NAME)

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(workspace.router)
app.include_router(chat.router)
app.include_router(message.router)

@app.get("/")
async def root():
    return {"message": "AI Chat Platform Backend API"}
