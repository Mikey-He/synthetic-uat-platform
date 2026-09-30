"""The research side of a run: the researcher console's API.

The runner uses it to create the synthetic session, record each step and end
the session by a stop rule. It runs in its own HTTP client, never in the
agent's browser, so the agent cannot see or reach the console.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import requests


@dataclass(frozen=True)
class Session:
    id: str
    token: str
    link: str
    variant: str


class ResearchConsole:
    def __init__(self, base_url: str, password: str, http: requests.Session | None = None):
        self.base = base_url.rstrip("/")
        self.http = http or requests.Session()
        response = self.http.post(
            f"{self.base}/api/admin/login", data={"password": password}, allow_redirects=False, timeout=30
        )
        if response.status_code != 303 or not response.headers.get("location", "").endswith("/admin"):
            raise RuntimeError("Researcher console sign-in failed. Check ADMIN_PASSWORD.")

    def create_session(
        self,
        *,
        model_id: str,
        prompt_version: str,
        persona_id: str,
        calibration_id: str | None,
        variant: str,
        temperature: float | None,
    ) -> Session:
        response = self.http.post(
            f"{self.base}/api/admin/sessions",
            json={
                "actorType": "synthetic",
                "modelId": model_id,
                "promptVersion": prompt_version,
                "personaId": persona_id,
                "calibrationId": calibration_id,
                "temperature": temperature,
                "variant": variant,
            },
            timeout=30,
        )
        response.raise_for_status()
        body = response.json()
        return Session(body["id"], body["token"], body["link"], body["variant"])

    def record_step(self, session_id: str, step: dict[str, Any]) -> None:
        response = self.http.post(f"{self.base}/api/admin/sessions/{session_id}/agent-steps", json=step, timeout=30)
        response.raise_for_status()

    def status(self, session_id: str) -> dict[str, Any]:
        response = self.http.get(f"{self.base}/api/admin/sessions/{session_id}", timeout=30)
        response.raise_for_status()
        return response.json()

    def end(self, session_id: str, reason: str) -> str:
        """Ends the session with reason, and returns the reason it ended with.
        If it had already ended (the agent clicked I'm finished), that reason wins."""
        response = self.http.post(
            f"{self.base}/api/admin/sessions/{session_id}/end", json={"terminationReason": reason}, timeout=30
        )
        if response.status_code == 409:
            return self.status(session_id)["terminationReason"]
        response.raise_for_status()
        return reason
