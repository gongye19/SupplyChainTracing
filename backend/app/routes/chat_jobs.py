from __future__ import annotations

import os
import secrets
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Response, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..schemas import (
    ChatJobClaimRequest,
    ChatJobCompleteRequest,
    ChatJobCreate,
    ChatJobFailureRequest,
    ChatJobResponse,
    ChatJobSystemStatus,
)
from ..services import chat_jobs as service


router = APIRouter()


def jobs_enabled() -> bool:
    return os.getenv("CHAT_JOBS_ENABLED", "false").lower() in {"1", "true", "yes", "on"}


def require_worker_token(authorization: Optional[str] = Header(default=None)) -> None:
    configured = os.getenv("CHAT_WORKER_TOKEN", "")
    if not configured:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Chat worker token is not configured")
    scheme, _, supplied = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not secrets.compare_digest(supplied, configured):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid worker token")


internal_router = APIRouter(dependencies=[Depends(require_worker_token)])


@router.get("/status", response_model=ChatJobSystemStatus)
def get_system_status():
    return {
        "enabled": jobs_enabled(),
        "message": "Chat worker is ready" if jobs_enabled() else "Chat worker is disabled",
    }


@router.post("", response_model=ChatJobResponse, status_code=status.HTTP_201_CREATED)
def create_chat_job(request: ChatJobCreate, db: Session = Depends(get_db)):
    if not jobs_enabled():
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Chat worker is disabled")
    return service.create_job(
        db,
        message=request.message.strip(),
        history=[item.model_dump() for item in request.history],
    )


@router.get("/{job_id}", response_model=ChatJobResponse)
def get_chat_job(job_id: str, db: Session = Depends(get_db)):
    job = service.get_job(db, job_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat job not found")
    return job


@internal_router.post("/claim")
def claim_chat_job(request: ChatJobClaimRequest, db: Session = Depends(get_db)):
    job = service.claim_job(db, request.worker_id)
    if job is None:
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    return job


@internal_router.post("/{job_id}/complete", response_model=ChatJobResponse)
def complete_chat_job(job_id: str, request: ChatJobCompleteRequest, db: Session = Depends(get_db)):
    job = service.complete_job(db, job_id, request.worker_id, request.answer)
    if job is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Worker does not own this chat job")
    return job


@internal_router.post("/{job_id}/fail", response_model=ChatJobResponse)
def fail_chat_job(job_id: str, request: ChatJobFailureRequest, db: Session = Depends(get_db)):
    job = service.fail_job(db, job_id, request.worker_id, request.error_message)
    if job is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Worker does not own this chat job")
    return job
