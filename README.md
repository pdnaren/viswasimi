# Viswasimi

AI-powered tutor for students in Classes 6–12 and competitive exams (JEE, NEET). Personalized AI chat tutoring, structured assessments, and progress analytics.

## Monorepo layout

This is a pnpm workspace with three apps:

| App | Path | Stack | Purpose |
| --- | --- | --- | --- |
| `web` | `apps/web` | Next.js 16, React 19, TypeScript | Marketing site, auth, and student dashboard |
| `backend` | `apps/backend` | FastAPI, SQLAlchemy, PostgreSQL | Core API — auth, curriculum, chat, progress, payments |
| `rag_backend` | `apps/rag_backend` | FastAPI, LangChain, pgvector | Document ingestion and retrieval-augmented tutoring |

## Prerequisites

- Node.js 20+ and [pnpm](https://pnpm.io/)
- Python 3.11+
- A PostgreSQL database (with the `pgvector` extension for `rag_backend`)

## Setup

### 1. Frontend (`apps/web`)

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local   # fill in values if not running the backend on localhost:8000
pnpm --filter web dev
```

The app runs at `http://localhost:3000`.

### 2. Backend (`apps/backend`)

```bash
cd apps/backend
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
cp .env.example .env          # fill in DATABASE_URL, OPENAI_API_KEY, etc.
uvicorn app.main:app --reload --port 8000
```

### 3. RAG backend (`apps/rag_backend`)

```bash
cd apps/rag_backend
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
cp .env.example .env          # fill in DATABASE_URL, OPENAI_API_KEY, INTERNAL_API_KEY
uvicorn app.main:app --reload --port 8001
```

Each `.env.example` lists every environment variable the service reads, with local-dev defaults where sensible. Never commit a real `.env` file — `.gitignore` excludes them, but double-check before pushing.

## Scripts

From the repo root (pnpm workspace):

```bash
pnpm --filter web dev      # start the Next.js dev server
pnpm --filter web build    # production build
pnpm --filter web lint     # lint the frontend
```

## Notes for contributors

- The frontend calls the backend via `getApiUrl()` (`apps/web/src/app/lib/api.ts`), which falls back to `http://localhost:8000` in local dev when `NEXT_PUBLIC_API_BASE_URL` is unset.
- `apps/backend` proxies document-tutoring requests to `apps/rag_backend` over HTTP using `INTERNAL_API_KEY` as a shared secret — both services need the same value.
- "Continue with Google" on the login/signup pages is not wired up yet (no OAuth route exists on the backend) and is intentionally disabled in the UI.
