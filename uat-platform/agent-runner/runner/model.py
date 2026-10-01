"""The model behind the agent. By default the latest stable Gemini model."""

from __future__ import annotations

from typing import Protocol

from .actions import ACTION_SCHEMA

# Google's latest stable model as of 2026-09-30 (ai.google.dev/gemini-api/docs/models):
# stable, and takes image input with structured output.
DEFAULT_MODEL = "gemini-3.8-flash"


class ModelError(Exception):
    """A call that returned nothing usable. label is a build plan failure code."""

    def __init__(self, label: str, message: str):
        super().__init__(message)
        self.label = label


class Model(Protocol):
    model_id: str

    def decide(self, system: str, turn: str, screenshot: bytes) -> str:
        """Returns the raw reply text for one turn."""
        ...


class GeminiModel:
    def __init__(self, api_key: str, model_id: str = DEFAULT_MODEL, temperature: float | None = None, timeout_s: int = 60):
        from google import genai  # imported here so tests run without the SDK configured

        self.model_id = model_id
        self.temperature = temperature
        self.timeout_ms = timeout_s * 1000
        self.client = genai.Client(api_key=api_key)

    def decide(self, system: str, turn: str, screenshot: bytes) -> str:
        from google.genai import errors, types

        config = types.GenerateContentConfig(
            system_instruction=system,
            response_mime_type="application/json",
            response_json_schema=ACTION_SCHEMA,
            temperature=self.temperature,
            http_options=types.HttpOptions(timeout=self.timeout_ms),
            automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),  # no tools here
        )
        contents = [
            types.Part.from_text(text=turn),
            types.Part.from_bytes(data=screenshot, mime_type="image/png"),
        ]
        try:
            response = self.client.models.generate_content(model=self.model_id, contents=contents, config=config)
        except errors.APIError as error:
            # The build plan has one code for a model call that fails; an API error is recorded as it.
            raise ModelError("model_timeout", f"API error {error.code}: {error.message}") from error
        except Exception as error:  # noqa: BLE001 - network timeouts surface as several exception types
            raise ModelError("model_timeout", str(error)) from error
        text = response.text
        if not text:
            raise ModelError("invalid_json", "empty reply")
        return text


class ScriptedModel:
    """Replays fixed replies. For tests and for checking a run's plumbing without a model."""

    def __init__(self, replies: list[str], model_id: str = "scripted"):
        self.model_id = model_id
        self.replies = list(replies)
        self.turns: list[str] = []

    def decide(self, system: str, turn: str, screenshot: bytes) -> str:
        self.turns.append(turn)
        if not self.replies:
            return '{"action": "give_up", "reason": "script ended"}'
        reply = self.replies.pop(0)
        if reply == "<timeout>":
            raise ModelError("model_timeout", "scripted timeout")
        return reply
