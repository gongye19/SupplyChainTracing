# Supply Chain Intelligence Platform

## Scope

This repository contains the public dashboard application only.

- `frontend/`: React 19 + TypeScript + Vite + D3 + Recharts
- `backend/app/`: FastAPI + SQLAlchemy + Pydantic
- PostgreSQL: local Docker on port 5433; Railway in production
- Deployment: Vercel frontend + Railway backend/database

Raw datasets, news cleaning, trade aggregation, and database publication belong in the separate private `supplychain-data-pipeline` repository. Codex analysis and report generation belong in the separate private `insight-factory` repository. Do not reintroduce those responsibilities here.

The lightweight Codex process belongs in `supplychain-chat-worker`. This repository owns only the `chat_jobs` Railway protocol and frontend polling client; it must never invoke Codex or a private model directly.

## Local development

```bash
docker compose up -d db
cd backend && uvicorn app.main:app --port 8001 --reload
cd frontend && npm run dev
```

The backend treats dashboard aggregate tables as read-only. Insight application tables are managed by `backend/app/services/insight_jobs.py`.

## Validation

```bash
cd backend && python -m pytest -q
cd frontend && npx tsc --noEmit && npm run build
```

## Git safety

Never commit `data/`, `database/`, `processed_tables/`, `local_research/`, `gdelt_test/`, `.env*`, virtual environments, `node_modules`, build output, generated reports, or credentials. Check `git status` before every commit and stage explicit paths when the worktree is mixed.
