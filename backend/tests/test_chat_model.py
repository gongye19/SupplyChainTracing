from app.services import chat_model


def test_generate_answer_calls_openai_compatible_endpoint(monkeypatch) -> None:
    captured = {}

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {"choices": [{"message": {"content": " Direct answer. "}}]}

    class FakeClient:
        def __init__(self, *, timeout):
            captured["timeout"] = timeout

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return None

        def post(self, url, *, headers, json):
            captured.update(url=url, headers=headers, payload=json)
            return FakeResponse()

    monkeypatch.setenv("CHAT_MODEL_BASE_URL", "http://model.test/v1/")
    monkeypatch.setenv("CHAT_MODEL_NAME", "test-model")
    monkeypatch.setenv("CHAT_MODEL_API_KEY", "test-key")
    monkeypatch.setenv("CHAT_MODEL_TIMEOUT_SECONDS", "30")
    monkeypatch.setattr(chat_model.httpx, "Client", FakeClient)

    answer = chat_model.generate_answer(
        "What changed?",
        [{"role": "assistant", "content": "Earlier context"}],
    )

    assert answer == "Direct answer."
    assert captured["url"] == "http://model.test/v1/chat/completions"
    assert captured["headers"]["Authorization"] == "Bearer test-key"
    assert captured["payload"]["model"] == "test-model"
    assert captured["payload"]["chat_template_kwargs"] == {"enable_thinking": False}
    assert captured["payload"]["messages"][-1] == {"role": "user", "content": "What changed?"}
