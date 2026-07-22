from __future__ import annotations

import os
import threading
from typing import Any

import httpx


SYSTEM_PROMPT = """You are the entry point to the supply-chain dashboard's quick Codex Agent.
Answer the user's question directly and concisely in the same language as the user.
The downstream Codex Agent has read-only tools for the project's structured country, HS-code, and company data.
For project-data questions, use those tools and never invent values.
Do not start the separate long-running Insight Factory report workflow.
Return only the final answer in Markdown; do not describe your reasoning process."""


class ChatModelConfigurationError(RuntimeError):
    pass


class ChatModelRequestError(RuntimeError):
    pass


class ChatModelBusyError(RuntimeError):
    pass


_MODEL_SLOTS = threading.BoundedSemaphore(
    value=max(1, int(os.getenv("CHAT_MODEL_MAX_CONCURRENCY", "1")))
)


def model_enabled() -> bool:
    return os.getenv("CHAT_MODEL_ENABLED", "false").lower() in {"1", "true", "yes", "on"}


def _required_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise ChatModelConfigurationError(f"{name} is not configured")
    return value


def _messages(message: str, history: list[dict[str, str]], max_history: int = 12) -> list[dict[str, str]]:
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages.extend(history[-max_history:])
    messages.append({"role": "user", "content": message})
    return messages


def generate_answer(message: str, history: list[dict[str, str]]) -> str:
    base_url = _required_env("CHAT_MODEL_BASE_URL").rstrip("/")
    model = _required_env("CHAT_MODEL_NAME")
    api_key = os.getenv("CHAT_MODEL_API_KEY", "").strip()
    timeout = float(os.getenv("CHAT_MODEL_TIMEOUT_SECONDS", "90"))
    max_tokens = int(os.getenv("CHAT_MODEL_MAX_TOKENS", "1200"))

    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    payload: dict[str, Any] = {
        "model": model,
        "messages": _messages(message, history),
        "temperature": 0.7,
        "top_p": 0.8,
        "top_k": 20,
        "chat_template_kwargs": {"enable_thinking": False},
        "max_tokens": max_tokens,
        "stream": False,
    }

    queue_timeout = float(os.getenv("CHAT_MODEL_QUEUE_TIMEOUT_SECONDS", "5"))
    if not _MODEL_SLOTS.acquire(timeout=queue_timeout):
        raise ChatModelBusyError("The laboratory model is busy; please retry shortly")

    try:
        try:
            with httpx.Client(timeout=timeout) as client:
                response = client.post(f"{base_url}/chat/completions", headers=headers, json=payload)
                response.raise_for_status()
        except httpx.TimeoutException as exc:
            raise ChatModelRequestError("The laboratory model timed out") from exc
        except httpx.HTTPStatusError as exc:
            raise ChatModelRequestError(f"The laboratory model returned HTTP {exc.response.status_code}") from exc
        except httpx.RequestError as exc:
            raise ChatModelRequestError("The laboratory model is unreachable") from exc
    finally:
        _MODEL_SLOTS.release()

    try:
        data = response.json()
        answer = data["choices"][0]["message"]["content"].strip()
    except (KeyError, IndexError, TypeError, ValueError, AttributeError) as exc:
        raise ChatModelRequestError("The laboratory model returned an invalid response") from exc

    if not answer:
        raise ChatModelRequestError("The laboratory model returned an empty answer")
    return answer[:100_000]
