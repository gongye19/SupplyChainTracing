# System Architecture

## Repository ownership

| Repository | Owns | Production runtime |
| --- | --- | --- |
| `supplychain` | Public React UI, FastAPI, dashboard queries, Insight job state and reports | Vercel + Railway |
| `supplychain-data-pipeline` | Dataset releases, cleaning, aggregation, validation, serving-table publication | Laboratory server |
| `insight-factory` | Codex analysis runner, prompts, Railway polling worker, report generation | Laboratory server |

GitHub is the source of truth for code. Production directories are deployments of known commits and are not edited in place.

## Data ownership

The persistent server dataset release is the authoritative raw-data source. Railway contains derived dashboard aggregates and application state, not a second manually maintained raw dataset.

```text
$SUPPLYCHAIN_DATA_ROOT/
├── releases/<dataset-version>/
│   ├── raw/
│   ├── cleaned/
│   ├── derived/
│   └── manifest.json
└── current -> releases/<dataset-version>
```

A release is immutable after activation. Pipeline publication uses staging tables, validates row counts and date coverage, and atomically swaps serving tables.

## Insight job sequence

1. A browser submits a question to the Railway API.
2. Railway stores a queued job with a dataset version.
3. The server worker claims the oldest available job over authenticated HTTPS.
4. The worker maintains a renewable lease and heartbeat.
5. Insight Factory runs against the declared server dataset release and the server's configured Codex model.
6. The worker uploads final Markdown and HTML with the Insight Factory Git revision.
7. The browser reads the completed report from Railway.

The server requires no public inbound application or model port. Administrative access remains through the private network/SSH.

## Security boundaries

- `INSIGHT_WORKER_TOKEN` exists only on Railway and the laboratory server.
- Pipeline database credentials exist only on the server.
- Vercel receives only the public API URL.
- Job submission remains disabled until the worker is supervised and tested.
- Source datasets, `.env` files, logs, and generated analysis artifacts are excluded from Git.
