# AI Chat Platform

This project is a full-stack AI chat application built to demonstrate authentication, workspace-based chat organization, persistent conversation history, real-time streaming responses, and live web search through an agent.

The goal of the system is to resemble a modern AI chat product while keeping the architecture simple, debuggable, and production-oriented.

## Assessment Notes

- No landing page by design; focus is on core functionality
- Conversation-level memory implemented as required
- Error states intentionally minimal for assessment scope
- Backend is deployed on Render free tier and may take ~20–30s to wake up after inactivity.

## Architecture Overview

* **Frontend**: Built using **Next.js 14** with the App Router and Tailwind CSS.
* **Backend**: Implemented using **FastAPI** with async endpoints, **PostgreSQL** for persistence, and **SQLAlchemy 2.0** as the ORM.
* **Authentication**: Handled using stateless **JWT tokens**.
* **AI Layer**: Uses **OpenRouter** for LLM inference and **Tavily** for live web search. **LangChain** is used in a minimal way only where tool calling and streaming are required.
* **Database**: Schema migrations are managed using **Alembic**.

## Local Setup

### Prerequisites

* Python 3.10 or higher
* Node.js 18 or higher
* PostgreSQL
* OpenRouter API key
* Tavily API key

### Backend Setup

1.  Navigate to the backend directory and create a virtual environment:
    ```bash
    cd backend
    python -m venv venv
    ```
2.  Activate the virtual environment and install dependencies:
    ```bash
    # On Windows: venv\Scripts\activate
    # On macOS/Linux: source venv/bin/activate
    pip install -r requirements.txt
    ```
3.  Copy the environment file and update it with database credentials and API keys:
    ```bash
    cp .env.example .env
    ```
4.  Run database migrations and start the server:
    ```bash
    alembic upgrade head
    uvicorn app.main:app --reload
    ```
    * The backend will be available at: `http://localhost:8000`
    * Interactive API docs are available at: `http://localhost:8000/docs`

### Frontend Setup

1.  Navigate to the frontend directory and install dependencies:
    ```bash
    cd frontend
    npm install
    npm run dev
    ```
2.  The frontend will be available at: `http://localhost:3000`

---

## Environment Variables

### Backend
| Variable | Description |
| :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string using `asyncpg` |
| `SECRET_KEY` | Key used to sign JWT tokens |
| `OPENROUTER_API_KEY` | API key used for LLM inference |
| `TAVILY_API_KEY` | API key used for live web search |
| `PROJECT_NAME` | Application name |

### Frontend
| Variable | Description |
| :--- | :--- |
| `NEXT_PUBLIC_API_URL` | Base URL of the backend API |

---

## Core Features

### Authentication and Workspaces
Each user has isolated access to their own workspaces. Chats belong to a workspace and cannot be accessed by other users.

### Chat System
* Users can create, delete, and clear chats within a workspace.
* Each chat maintains its own message history and persists across sessions using the database.
* Chats are automatically renamed after the first message using a short LLM-generated summary.

### Streaming Responses
AI responses stream token by token to the UI. Streaming is implemented for both standard chat and agent-based responses.

### Web Search Agent
* The agent performs live web search using **Tavily** and reports findings based on the returned results.
* The agent is intentionally designed as a search-reporting system rather than a strict fact-verification system. If search results exist, the agent summarizes what they indicate. 
* **Normal Mode**: Relies only on the model’s training data.
* **Agent Mode**: Explicitly uses live web search.

### Token Safety and Cost Control
* **History Pruning**: Conversation history is dynamically pruned based on character count using an approximate token-to-character ratio. Older messages are dropped first while preserving recent instructions.
* **Truncation**: Search results are capped to a small number of results, with each result truncated to a fixed length to prevent context bloat.
* **Generation Caps**: LLM output tokens are capped to avoid runaway generation.

## Deployment

Backend deployed on Render using FastAPI with async PostgreSQL (Supabase).

Frontend deployed on Vercel (Next.js + TypeScript + Tailwind).

Environment-based config: frontend uses NEXT_PUBLIC_API_BASE_URL, backend uses Render env vars.

Database: Supabase Postgres with manually applied schema (auth, workspaces, chats, messages).
