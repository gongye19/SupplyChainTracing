# Supply Chain Intelligence Platform

Public dashboard and API for semiconductor supply-chain trade intelligence.

This repository owns the user-facing application only. Raw datasets, cleaning, aggregation, and production data publication live in the private `supplychain-data-pipeline` repository. Long-running Codex analysis lives in the private `insight-factory` repository.

## Repository layout

```text
supplychain/
├── frontend/       React 19 + TypeScript + Vite dashboard
├── backend/app/    FastAPI query and Insight job API
├── docs/           Application and deployment documentation
├── docker-compose.yml
├── railway.json
└── README.md
```

No source datasets or database runtime files belong in this repository.

## Local workspace boundaries

The recommended Mac development layout keeps code repositories and the shared dataset beside one another:

```text
/Users/han/Desktop/code/
├── supplychain/                Git repository: dashboard application
├── supplychain-data-pipeline/  Git repository: cleaning and publication
├── insight_factory/            Git repository: Codex analysis worker
└── supplychain-data/           Not Git: versioned raw/cleaned/derived data
```

Both Data Pipeline and Insight Factory use `SUPPLYCHAIN_DATA_ROOT=/Users/han/Desktop/code/supplychain-data`. This gives them one physical data source without putting data inside an application repository.

## Local development

Start PostgreSQL:

```bash
docker compose up -d db
```

Start the backend:

```bash
cd backend
python3.11 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --port 8001 --reload
```

Start the frontend in another terminal:

```bash
cd frontend
npm install
npm run dev
```

Local endpoints:

- Frontend: `http://localhost:3000`
- API: `http://localhost:8001`
- API documentation: `http://localhost:8001/docs`
- PostgreSQL: `localhost:5433`

The local database is intentionally empty on first start. Publish synthetic/sample aggregates with `supplychain-data-pipeline`; do not copy raw production data into this repository.

## Production

- `frontend/` deploys to Vercel.
- `backend/` deploys to Railway.
- Railway PostgreSQL stores dashboard aggregates, Insight job state, and final report content.
- The laboratory server runs Data Pipeline and Insight Factory workers.
- The server reaches Railway through outbound HTTPS; no model port is public.

## Insight job flow

1. The frontend submits a research question to `POST /api/insight-jobs`.
2. The Railway API records a queued job.
3. The server worker claims it through authenticated `/api/internal/insight-jobs/*` endpoints.
4. Insight Factory analyzes the declared dataset version with the server's Codex model.
5. The worker uploads reviewed Markdown and HTML.
6. The frontend polls job status and displays the completed report.

The frontend deliberately exposes two separate AI experiences:

- The floating assistant in the lower-right corner is the existing lightweight question-and-answer interface backed by `/api/chat`.
- **Insight Reports** is a full dashboard for long-running Insight Factory jobs, progress, history, and generated reports backed by `/api/insight-jobs`.

Job submission is disabled by default. Set `INSIGHT_JOBS_ENABLED=true`, `DEFAULT_DATASET_VERSION`, and a strong `INSIGHT_WORKER_TOKEN` in Railway only after the server worker is deployed.

## Data ownership

Serving aggregate tables are produced atomically by `supplychain-data-pipeline`. The API treats them as read-only. Application tables such as `insight_jobs` and `insight_reports` are owned by this backend.

Every report records both `dataset_version` and `factory_version` for reproducibility.
