from fastapi.testclient import TestClient

from app.main import app


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
