from fastapi.testclient import TestClient

from app.main import app
from app.routes import insight_jobs


client = TestClient(app)


def test_insight_jobs_are_disabled_by_default(monkeypatch) -> None:
    monkeypatch.delenv("INSIGHT_JOBS_ENABLED", raising=False)
    response = client.get("/api/insight-jobs/status")
    assert response.status_code == 200
    assert response.json()["enabled"] is False

    response = client.post(
        "/api/insight-jobs",
        json={"research_question": "Which trade change is most important?", "dataset_version": "test-v1"},
    )
    assert response.status_code == 503


def test_internal_routes_require_worker_token(monkeypatch) -> None:
    monkeypatch.setenv("INSIGHT_WORKER_TOKEN", "test-secret")
    response = client.post("/api/internal/insight-jobs/claim", json={"worker_id": "test-worker"})
    assert response.status_code == 401


def test_health_does_not_depend_on_worker_configuration() -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}


def test_list_insight_jobs_supports_status_and_limit(monkeypatch) -> None:
    def fake_list_jobs(_db, *, job_status, limit):
        assert job_status == "completed"
        assert limit == 7
        return [
            {
                "job_id": "job-1",
                "status": "completed",
                "research_question": "What changed in semiconductor trade flows?",
                "dataset_version": "2026-07-14",
                "target_step": 5,
                "stream_count": 2,
                "current_step": 5,
                "cancel_requested": False,
                "created_at": "2026-07-14T00:00:00Z",
                "completed_at": "2026-07-14T00:05:00Z",
                "updated_at": "2026-07-14T00:05:00Z",
            }
        ]

    monkeypatch.setattr(insight_jobs.service, "list_jobs", fake_list_jobs)
    response = client.get("/api/insight-jobs?status=completed&limit=7")

    assert response.status_code == 200
    assert response.json()[0]["job_id"] == "job-1"
