"""The action format (build plan, Action format): parsing, checks and execution.

The browser is touched only through page.mouse, page.keyboard and
page.wait_for_timeout here, as the forbidden-call test in the web app enforces.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

WIDTH, HEIGHT = 1440, 900

ACTIONS = ("click", "double_click", "type", "key", "scroll", "wait", "give_up")

# Sent to the model as its response schema.
ACTION_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "action": {"type": "string", "enum": list(ACTIONS)},
        "x": {"type": "integer"},
        "y": {"type": "integer"},
        "text": {"type": "string"},
        "key": {"type": "string"},
        "dy": {"type": "integer"},
        "ms": {"type": "integer"},
        "reason": {"type": "string"},
    },
    "required": ["action", "reason"],
}

# Fields each action needs, besides reason.
_FIELDS = {
    "click": ("x", "y"),
    "double_click": ("x", "y"),
    "type": ("text",),
    "key": ("key",),
    "scroll": ("dy",),
    "wait": ("ms",),
    "give_up": (),
}

MAX_WAIT_MS = 10_000


class ActionError(Exception):
    """An action that cannot run. label is one of the build plan's failure codes."""

    def __init__(self, label: str, message: str):
        super().__init__(message)
        self.label = label


@dataclass(frozen=True)
class Action:
    kind: str
    args: dict[str, Any]
    reason: str | None

    def as_json(self) -> dict[str, Any]:
        return {"action": self.kind, **self.args, "reason": self.reason}

    def signature(self) -> str:
        """What counts as the same action for the loop rule: everything but the reason."""
        return json.dumps({"action": self.kind, **self.args}, sort_keys=True)


def parse_action(raw: str) -> Action:
    """Reads one action from the model's reply. Raises ActionError."""
    try:
        data = json.loads(raw)
    except (TypeError, ValueError) as error:
        raise ActionError("invalid_json", f"not JSON: {error}") from error
    if not isinstance(data, dict):
        raise ActionError("invalid_json", "not a JSON object")
    kind = data.get("action")
    if kind not in _FIELDS:
        raise ActionError("invalid_json", f"unknown action {kind!r}")
    reason = data.get("reason")
    args: dict[str, Any] = {}
    for field in _FIELDS[kind]:
        value = data.get(field)
        if field in ("x", "y", "dy", "ms"):
            if isinstance(value, bool) or not isinstance(value, (int, float)):
                raise ActionError("invalid_json", f"{kind} needs a number for {field}")
            value = int(round(value))
        elif not isinstance(value, str) or value == "":
            raise ActionError("invalid_json", f"{kind} needs text for {field}")
        args[field] = value
    action = Action(kind, args, reason if isinstance(reason, str) else None)
    _check_bounds(action)
    return action


def _check_bounds(action: Action) -> None:
    if action.kind in ("click", "double_click"):
        x, y = action.args["x"], action.args["y"]
        if not (0 <= x < WIDTH and 0 <= y < HEIGHT):
            raise ActionError("out_of_bounds", f"({x}, {y}) is outside {WIDTH} x {HEIGHT}")


def execute(page: Any, action: Action) -> None:
    """Performs one action with the mouse and keyboard only. Raises ActionError."""
    try:
        if action.kind == "click":
            page.mouse.click(action.args["x"], action.args["y"])
        elif action.kind == "double_click":
            page.mouse.dblclick(action.args["x"], action.args["y"])
        elif action.kind == "type":
            page.keyboard.type(action.args["text"])
        elif action.kind == "key":
            page.keyboard.press(action.args["key"])
        elif action.kind == "scroll":
            # The wheel scrolls what is under the pointer, so point at the page body first.
            page.mouse.move(WIDTH // 2, HEIGHT // 2 + 100)
            page.mouse.wheel(0, action.args["dy"])
        elif action.kind == "wait":
            page.wait_for_timeout(max(0, min(action.args["ms"], MAX_WAIT_MS)))
    except Exception as error:  # noqa: BLE001 - any browser failure is labelled the same way
        raise ActionError("browser_error", str(error)) from error
