from fastapi.testclient import TestClient

from app.main import app
from app.routes import chat_jobs


client = TestClient(app)


def test_chat_jobs_are_disabled_by_default(monkeypatch) -> None:
    monkeypatch.delenv("CHAT_JOBS_ENABLED", raising=False)
    response = client.get("/api/chat-jobs/status")
    assert response.status_code == 200
    assert response.json()["enabled"] is False

    response = client.post("/api/chat-jobs", json={"message": "What changed?", "history": []})
    assert response.status_code == 503


def test_internal_chat_routes_require_worker_token(monkeypatch) -> None:
    monkeypatch.setenv("CHAT_WORKER_TOKEN", "test-secret")
    response = client.post("/api/internal/chat-jobs/claim", json={"worker_id": "chat-worker-1"})
    assert response.status_code == 401


def test_get_chat_job_returns_worker_result(monkeypatch) -> None:
    monkeypatch.setattr(
        chat_jobs.service,
        "get_job",
        lambda _db, _job_id: {
            "job_id": "chat-1",
            "status": "completed",
            "message": "What changed?",
            "history": [],
            "answer": "Trade concentration increased.",
            "created_at": "2026-07-14T00:00:00Z",
            "completed_at": "2026-07-14T00:00:05Z",
            "updated_at": "2026-07-14T00:00:05Z",
        },
    )

    response = client.get("/api/chat-jobs/chat-1")
    assert response.status_code == 200
    assert response.json()["answer"] == "Trade concentration increased."
