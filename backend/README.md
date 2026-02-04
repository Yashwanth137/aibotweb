# Backend - AI Chat Platform

Foundational FastAPI backend handling auth, database persistence, and AI inference.

## Project Structure

```
backend/
├── app/
│   ├── main.py          # Entrypoint
│   ├── api/             # Routers (auth, chats, workspaces)
│   ├── core/            # Config, DB connection
│   ├── models/          # SQLAlchemy Models
│   └── schemas/         # Pydantic Schemas
├── alembic/             # Migrations
├── requirements.txt     # Python Dependencies
└── .env.example         # Config Template
```

## 🛠 Commands

### Run Development Server
```bash
uvicorn app.main:app --reload
```

### Database Migrations
**Create a new migration:**
```bash
alembic revision --autogenerate -m "description"
```
**Apply migrations:**
```bash
alembic upgrade head
```

## Agent Pipeline

The application features a custom RAG (Retrieval-Augmented Generation) pipeline instead of a generic ReAct agent for stability and speed.
- **Endpoint**: `/chats/agent/stream`
- **Logic**: 
  1. Receive user query.
  2. Perform Tavily Search (Server-side).
  3. Normalize results into a single context string.
  4. Inject Context + System Prompt into LLM.
  5. Stream response.
