# System Architecture

## Repository ownership

| Repository | Owns | Production runtime |
| --- | --- | --- |
| `supplychain` | Public React UI, FastAPI, dashboard queries, Insight job state and reports | Vercel + Railway |
| `supplychain-data-pipeline` | Source validation, cleaning, aggregation, and serving-table publication | Laboratory server |
| `insight-factory` | Codex analysis runner, prompts, Railway polling worker, report generation | Laboratory server |

GitHub is the source of truth for code. Production directories are deployments of known commits and are not edited in place.

## Data ownership

The latest dated dataset directory is the authoritative source. Railway contains derived dashboard aggregates and application state, not a second manually maintained source dataset.

During Mac development, the shared root is `/Users/han/Desktop/code/supplychain-data`. It is adjacent to the three code repositories and is never itself committed to Git. A production server may mount the same layout elsewhere by changing `SUPPLYCHAIN_DATA_ROOT`; no code path depends on the Mac absolute path.

```text
$SUPPLYCHAIN_DATA_ROOT/
└── YYYY-MM-DD/
    ├── trade/
    │   └── *.csv
    └── news/
        └── news_events.json
```

Only the latest date directory is kept. Cleaning outputs and reports live in Data Pipeline runtime artifacts, never in this source directory. Pipeline publication uses staging tables, validates row counts and date coverage, and atomically swaps serving tables.

## Insight job sequence

1. A browser submits a question to the Railway API.
2. Railway stores a queued job with a dataset version.
3. The server worker claims the oldest available job over authenticated HTTPS.
4. The worker maintains a renewable lease and heartbeat.
5. Insight Factory runs against the declared dated dataset and the server's configured Codex model.
6. The worker uploads final Markdown and HTML with the Insight Factory Git revision.
7. The browser reads the completed report from Railway.

Insight Factory reports have their own **Insight Reports** dashboard. The floating Agent remains a separate, lightweight `/api/chat` question-and-answer experience and does not own or render long-running reports.

The server requires no public inbound application or model port. Administrative access remains through the private network/SSH.

## Security boundaries

- `INSIGHT_WORKER_TOKEN` exists only on Railway and the laboratory server.
- Pipeline database credentials exist only on the server.
- Vercel receives only the public API URL.
- Job submission remains disabled until the worker is supervised and tested.
- Source datasets, `.env` files, logs, and generated analysis artifacts are excluded from Git.
