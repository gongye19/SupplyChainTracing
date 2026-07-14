from __future__ import annotations

import os
import secrets
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..schemas import (
    InsightJobClaimRequest,
    InsightJobCompleteRequest,
    InsightJobCreate,
    InsightJobFailureRequest,
    InsightJobHeartbeatRequest,
    InsightJobResponse,
    InsightJobStatus,
    InsightJobSystemStatus,
    InsightReportResponse,
)
from ..services import insight_jobs as service


router = APIRouter()


def jobs_enabled() -> bool:
    return os.getenv("INSIGHT_JOBS_ENABLED", "false").lower() in {"1", "true", "yes", "on"}


def require_worker_token(authorization: Optional[str] = Header(default=None)) -> None:
    configured = os.getenv("INSIGHT_WORKER_TOKEN", "")
    if not configured:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Insight worker token is not configured")
    scheme, _, supplied = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not secrets.compare_digest(supplied, configured):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid worker token")


internal_router = APIRouter(dependencies=[Depends(require_worker_token)])


@router.get("/status", response_model=InsightJobSystemStatus)
def get_system_status():
    return {
        "enabled": jobs_enabled(),
        "default_dataset_version": os.getenv("DEFAULT_DATASET_VERSION"),
        "message": "Insight jobs are ready" if jobs_enabled() else "Insight job submission is disabled",
    }


@router.post("", response_model=InsightJobResponse, status_code=status.HTTP_201_CREATED)
def create_insight_job(request: InsightJobCreate, db: Session = Depends(get_db)):
    if not jobs_enabled():
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Insight job submission is disabled")
    dataset_version = request.dataset_version or os.getenv("DEFAULT_DATASET_VERSION")
    if not dataset_version:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="dataset_version is required")
    return service.create_job(
        db,
        research_question=request.research_question.strip(),
        dataset_version=dataset_version,
        target_step=request.target_step,
        stream_count=request.stream_count,
        requested_by=request.requested_by,
    )


@router.get("", response_model=list[InsightJobResponse])
def list_insight_jobs(
    job_status: Optional[InsightJobStatus] = Query(default=None, alias="status"),
    limit: int = Query(default=50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    return service.list_jobs(db, job_status=job_status, limit=limit)


@router.get("/{job_id}", response_model=InsightJobResponse)
def get_insight_job(job_id: str, db: Session = Depends(get_db)):
    job = service.get_job(db, job_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Insight job not found")
    return job


@router.get("/{job_id}/report", response_model=InsightReportResponse)
def get_insight_report(job_id: str, db: Session = Depends(get_db)):
    report = service.get_report(db, job_id)
    if report is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Insight report not found")
    return report


@router.post("/{job_id}/cancel", response_model=InsightJobResponse)
def cancel_insight_job(job_id: str, db: Session = Depends(get_db)):
    job = service.request_cancel(db, job_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Job cannot be cancelled")
    return job


@internal_router.post("/claim")
def claim_insight_job(request: InsightJobClaimRequest, db: Session = Depends(get_db)):
    job = service.claim_job(db, request.worker_id)
    if job is None:
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    return job


@internal_router.post("/{job_id}/heartbeat")
def heartbeat_insight_job(job_id: str, request: InsightJobHeartbeatRequest, db: Session = Depends(get_db)):
    result = service.heartbeat(db, job_id, request.worker_id, request.current_step)
    if result is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Worker does not own this job")
    return result


@internal_router.post("/{job_id}/complete", response_model=InsightJobResponse)
def complete_insight_job(job_id: str, request: InsightJobCompleteRequest, db: Session = Depends(get_db)):
    result = service.complete_job(
        db,
        job_id,
        request.worker_id,
        request.model_dump(exclude={"worker_id"}),
    )
    if result is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Worker does not own this job")
    return result


@internal_router.post("/{job_id}/fail", response_model=InsightJobResponse)
def fail_insight_job(job_id: str, request: InsightJobFailureRequest, db: Session = Depends(get_db)):
    result = service.finish_job(db, job_id, request.worker_id, status="failed", message=request.error_message)
    if result is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Worker does not own this job")
    return result


@internal_router.post("/{job_id}/cancelled", response_model=InsightJobResponse)
def mark_insight_job_cancelled(job_id: str, request: InsightJobFailureRequest, db: Session = Depends(get_db)):
    result = service.finish_job(db, job_id, request.worker_id, status="cancelled", message=request.error_message or request.message)
    if result is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Worker does not own this job")
    return result
