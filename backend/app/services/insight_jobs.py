from __future__ import annotations

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
                    CREATE TABLE IF NOT EXISTS insight_jobs (
                        job_id VARCHAR(36) PRIMARY KEY,
                        status VARCHAR(20) NOT NULL DEFAULT 'queued',
                        research_question TEXT NOT NULL,
                        dataset_version VARCHAR(128) NOT NULL,
                        target_step INTEGER NOT NULL DEFAULT 5,
                        stream_count INTEGER NOT NULL DEFAULT 2,
                        requested_by VARCHAR(255),
                        worker_id VARCHAR(255),
                        lease_expires_at TIMESTAMPTZ,
                        heartbeat_at TIMESTAMPTZ,
                        current_step INTEGER NOT NULL DEFAULT 0,
                        cancel_requested BOOLEAN NOT NULL DEFAULT FALSE,
                        error_message TEXT,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        started_at TIMESTAMPTZ,
                        completed_at TIMESTAMPTZ,
                        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
                    )
                    """
                )
            )
            db.execute(text("CREATE INDEX IF NOT EXISTS idx_insight_jobs_status_created ON insight_jobs (status, created_at)"))
            db.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS insight_reports (
                        job_id VARCHAR(36) PRIMARY KEY REFERENCES insight_jobs(job_id) ON DELETE CASCADE,
                        dataset_version VARCHAR(128) NOT NULL,
                        factory_version VARCHAR(128) NOT NULL,
                        executive_summary TEXT,
                        report_markdown TEXT NOT NULL,
                        report_html TEXT NOT NULL,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
                    )
                    """
                )
            )
            db.commit()
            _schema_ready = True
        except Exception:
            db.rollback()
            raise


def create_job(
    db: Session,
    *,
    research_question: str,
    dataset_version: str,
    target_step: int,
    stream_count: int,
    requested_by: str | None,
) -> dict[str, Any]:
    ensure_schema(db)
    job_id = str(uuid.uuid4())
    row = db.execute(
        text(
            """
            INSERT INTO insight_jobs (
                job_id, research_question, dataset_version, target_step, stream_count, requested_by
            ) VALUES (
                :job_id, :research_question, :dataset_version, :target_step, :stream_count, :requested_by
            )
            RETURNING *
            """
        ),
        {
            "job_id": job_id,
            "research_question": research_question,
            "dataset_version": dataset_version,
            "target_step": target_step,
            "stream_count": stream_count,
            "requested_by": requested_by,
        },
    ).fetchone()
    db.commit()
    return _mapping(row) or {}


def get_job(db: Session, job_id: str) -> dict[str, Any] | None:
    ensure_schema(db)
    return _mapping(db.execute(text("SELECT * FROM insight_jobs WHERE job_id = :job_id"), {"job_id": job_id}).fetchone())


def get_report(db: Session, job_id: str) -> dict[str, Any] | None:
    ensure_schema(db)
    return _mapping(
        db.execute(text("SELECT * FROM insight_reports WHERE job_id = :job_id"), {"job_id": job_id}).fetchone()
    )


def request_cancel(db: Session, job_id: str) -> dict[str, Any] | None:
    ensure_schema(db)
    row = db.execute(
        text(
            """
            UPDATE insight_jobs
            SET cancel_requested = TRUE,
                status = CASE WHEN status = 'queued' THEN 'cancelled' ELSE status END,
                completed_at = CASE WHEN status = 'queued' THEN CURRENT_TIMESTAMP ELSE completed_at END,
                updated_at = CURRENT_TIMESTAMP
            WHERE job_id = :job_id AND status IN ('queued', 'running')
            RETURNING *
            """
        ),
        {"job_id": job_id},
    ).fetchone()
    db.commit()
    return _mapping(row)

def claim_job(db: Session, worker_id: str) -> dict[str, Any] | None:
    ensure_schema(db)
    row = db.execute(
        text(
            f"""
            WITH candidate AS (
                SELECT job_id
                FROM insight_jobs
                WHERE cancel_requested = FALSE
                  AND (
                    status = 'queued'
                    OR (status = 'running' AND lease_expires_at < CURRENT_TIMESTAMP)
                  )
                ORDER BY created_at
                FOR UPDATE SKIP LOCKED
                LIMIT 1
            )
            UPDATE insight_jobs AS jobs
            SET status = 'running',
                worker_id = :worker_id,
                started_at = COALESCE(started_at, CURRENT_TIMESTAMP),
                heartbeat_at = CURRENT_TIMESTAMP,
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


def heartbeat(db: Session, job_id: str, worker_id: str, current_step: int) -> dict[str, Any] | None:
    ensure_schema(db)
    row = db.execute(
        text(
            f"""
            UPDATE insight_jobs
            SET heartbeat_at = CURRENT_TIMESTAMP,
                lease_expires_at = CURRENT_TIMESTAMP + INTERVAL '{LEASE_MINUTES} minutes',
                current_step = :current_step,
                updated_at = CURRENT_TIMESTAMP
            WHERE job_id = :job_id AND status = 'running' AND worker_id = :worker_id
            RETURNING job_id, cancel_requested
            """
        ),
        {"job_id": job_id, "worker_id": worker_id, "current_step": current_step},
    ).fetchone()
    db.commit()
    return _mapping(row)


def complete_job(db: Session, job_id: str, worker_id: str, payload: dict[str, Any]) -> dict[str, Any] | None:
    ensure_schema(db)
    try:
        job = db.execute(
            text(
                """
                UPDATE insight_jobs
                SET status = 'completed', current_step = 5, completed_at = CURRENT_TIMESTAMP,
                    lease_expires_at = NULL, updated_at = CURRENT_TIMESTAMP
                WHERE job_id = :job_id AND status = 'running' AND worker_id = :worker_id
                RETURNING *
                """
            ),
            {"job_id": job_id, "worker_id": worker_id},
        ).fetchone()
        if job is None:
            db.rollback()
            return None
        db.execute(
            text(
                """
                INSERT INTO insight_reports (
                    job_id, dataset_version, factory_version, executive_summary, report_markdown, report_html
                ) VALUES (
                    :job_id, :dataset_version, :factory_version, :executive_summary, :report_markdown, :report_html
                )
                ON CONFLICT (job_id) DO UPDATE SET
                    dataset_version = EXCLUDED.dataset_version,
                    factory_version = EXCLUDED.factory_version,
                    executive_summary = EXCLUDED.executive_summary,
                    report_markdown = EXCLUDED.report_markdown,
                    report_html = EXCLUDED.report_html,
                    updated_at = CURRENT_TIMESTAMP
                """
            ),
            {"job_id": job_id, **payload},
        )
        db.commit()
        return _mapping(job)
    except Exception:
        db.rollback()
        raise


def finish_job(db: Session, job_id: str, worker_id: str, *, status: str, message: str | None) -> dict[str, Any] | None:
    ensure_schema(db)
    row = db.execute(
        text(
            """
            UPDATE insight_jobs
            SET status = :status, error_message = :message, completed_at = CURRENT_TIMESTAMP,
                lease_expires_at = NULL, updated_at = CURRENT_TIMESTAMP
            WHERE job_id = :job_id AND status = 'running' AND worker_id = :worker_id
            RETURNING *
            """
        ),
        {"job_id": job_id, "worker_id": worker_id, "status": status, "message": message},
    ).fetchone()
    db.commit()
    return _mapping(row)
