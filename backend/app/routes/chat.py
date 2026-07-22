from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from ..schemas import ChatDirectResponse, ChatJobCreate, ChatJobSystemStatus
from ..services import chat_model


router = APIRouter()


@router.get("/status", response_model=ChatJobSystemStatus)
def get_system_status():
    enabled = chat_model.model_enabled()
    return {
        "enabled": enabled,
        "message": "Direct laboratory model access is ready" if enabled else "Direct chat is disabled",
    }


@router.post("", response_model=ChatDirectResponse)
def create_chat_response(request: ChatJobCreate):
    if not chat_model.model_enabled():
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Direct chat is disabled")

    try:
        answer = chat_model.generate_answer(
            request.message.strip(),
            [item.model_dump() for item in request.history],
        )
    except chat_model.ChatModelConfigurationError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except chat_model.ChatModelRequestError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    return {"response": answer}
