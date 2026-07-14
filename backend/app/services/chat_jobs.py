from __future__ import annotations

import json
import threading
import uuid
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session


LEASE_MINUTES = 5
_schema_ready = False
_schema_lock = threading.Lock()


def _mapping(row) -> dict[str, Any] | None:
    return dict(row._mapping) if row is not None else None


def ensure_schema(db: Session) -> None:
    global _schema_ready
    if _schema_ready:
        return
    with _schema_lock:
        if _schema_ready:
            return
        try:
            db.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS chat_jobs (
                        job_id VARCHAR(36) PRIMARY KEY,
                        status VARCHAR(20) NOT NULL DEFAULT 'queued',
                        message TEXT NOT NULL,
                        history JSONB NOT NULL DEFAULT '[]'::jsonb,
                        answer TEXT,
                        error_message TEXT,
                        worker_id VARCHAR(255),
                        lease_expires_at TIMESTAMPTZ,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        started_at TIMESTAMPTZ,
                        completed_at TIMESTAMPTZ,
                        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
                    )
                    """
                )
            )
            db.execute(text("CREATE INDEX IF NOT EXISTS idx_chat_jobs_status_created ON chat_jobs (status, created_at)"))
            db.commit()
            _schema_ready = True
        except Exception:
            db.rollback()
            raise


def create_job(db: Session, *, message: str, history: list[dict[str, str]]) -> dict[str, Any]:
    ensure_schema(db)
    db.execute(text("DELETE FROM chat_jobs WHERE completed_at < CURRENT_TIMESTAMP - INTERVAL '7 days'"))
    row = db.execute(
        text(
            """
            INSERT INTO chat_jobs (job_id, message, history)
            VALUES (:job_id, :message, CAST(:history AS JSONB))
            RETURNING *
            """
        ),
        {"job_id": str(uuid.uuid4()), "message": message, "history": json.dumps(history, ensure_ascii=False)},
    ).fetchone()
    db.commit()
    return _mapping(row) or {}


def get_job(db: Session, job_id: str) -> dict[str, Any] | None:
    ensure_schema(db)
    return _mapping(db.execute(text("SELECT * FROM chat_jobs WHERE job_id = :job_id"), {"job_id": job_id}).fetchone())


def claim_job(db: Session, worker_id: str) -> dict[str, Any] | None:
    ensure_schema(db)
    row = db.execute(
        text(
            f"""
            WITH candidate AS (
                SELECT job_id
                FROM chat_jobs
                WHERE status = 'queued'
                   OR (status = 'running' AND lease_expires_at < CURRENT_TIMESTAMP)
                ORDER BY created_at
                FOR UPDATE SKIP LOCKED
                LIMIT 1
            )
            UPDATE chat_jobs AS jobs
            SET status = 'running',
                worker_id = :worker_id,
                started_at = COALESCE(started_at, CURRENT_TIMESTAMP),
                lease_expires_at = CURRENT_TIMESTAMP + INTERVAL '{LEASE_MINUTES} minutes',
                updated_at = CURRENT_TIMESTAMP
            FROM candidate
            WHERE jobs.job_id = candidate.job_id
            RETURNING jobs.*
            """
        ),
        {"worker_id": worker_id},
    ).fetchone()
    db.commit()
    return _mapping(row)


def complete_job(db: Session, job_id: str, worker_id: str, answer: str) -> dict[str, Any] | None:
    ensure_schema(db)
    row = db.execute(
        text(
            """
            UPDATE chat_jobs
            SET status = 'completed', answer = :answer, error_message = NULL,
                completed_at = CURRENT_TIMESTAMP, lease_expires_at = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE job_id = :job_id AND status = 'running' AND worker_id = :worker_id
            RETURNING *
            """
        ),
        {"job_id": job_id, "worker_id": worker_id, "answer": answer},
    ).fetchone()
    db.commit()
    return _mapping(row)


def fail_job(db: Session, job_id: str, worker_id: str, error_message: str) -> dict[str, Any] | None:
    ensure_schema(db)
    row = db.execute(
        text(
            """
            UPDATE chat_jobs
            SET status = 'failed', error_message = :error_message,
                completed_at = CURRENT_TIMESTAMP, lease_expires_at = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE job_id = :job_id AND status = 'running' AND worker_id = :worker_id
            RETURNING *
            """
        ),
        {"job_id": job_id, "worker_id": worker_id, "error_message": error_message},
    ).fetchone()
    db.commit()
    return _mapping(row)
