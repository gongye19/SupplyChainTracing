from fastapi import APIRouter

from ..schemas import InsightAgentPreviewRequest, InsightAgentPreviewResponse, InsightAgentStatus
from ..services.insights_agent import preview_payload, status_payload


router = APIRouter()


@router.get("/status", response_model=InsightAgentStatus)
def get_insights_agent_status():
    return status_payload()


@router.post("/preview", response_model=InsightAgentPreviewResponse)
def preview_insights_agent(request: InsightAgentPreviewRequest):
    return preview_payload(request)
