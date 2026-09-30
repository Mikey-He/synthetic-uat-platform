"""One agent run (build plan, The loop, and Stop rules and labels).

Each turn: take a screenshot, show it to the model with the task, the persona,
any frozen calibration text and the last five actions, perform the one action
it returns, and record the step. The agent sees the screenshot and nothing else.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

from .actions import Action, ActionError, execute, parse_action
from .model import Model, ModelError

MAX_STEPS = 80
MAX_SECONDS = 20 * 60
LOOP_LENGTH = 6  # identical actions in a row
MAX_RETRIES = 2  # a model or browser failure ends the run after two retries
SETTLE_MS = 800  # wait after each action before the next screenshot
HISTORY = 5


@dataclass
class Prompt:
    system: str
    task: str
    persona: str
    calibration: str | None = None

    def instructions(self) -> str:
        parts = [self.system.strip(), self.persona.strip()]
        if self.calibration:
            parts.append(self.calibration.strip())
        return "\n\n".join(parts)

    def turn(self, history: list[Action]) -> str:
        lines = ["## Task", self.task.strip(), "", "## Your last actions"]
        if history:
            lines += [f"{i}. {a.signature()} because: {a.reason or ''}" for i, a in enumerate(history, 1)]
        else:
            lines.append("None yet. This is the first screenshot.")
        lines += ["", "Here is the current screenshot. Reply with your next action."]
        return "\n".join(lines)


@dataclass
class Outcome:
    termination_reason: str
    steps: int
    seconds: float
    labels: list[str] = field(default_factory=list)


class Recorder:
    """Where a run writes its steps and screenshots. The console implements the
    step store; tests use an in-memory one."""

    def __init__(self, record_step: Callable[[dict[str, Any]], None], shots_dir: Path, shots_root: Path):
        self.record_step = record_step
        self.shots_dir = shots_dir
        self.shots_root = shots_root

    def save_shot(self, step_no: int, png: bytes) -> str:
        self.shots_dir.mkdir(parents=True, exist_ok=True)
        path = self.shots_dir / f"step-{step_no:03d}.png"
        path.write_bytes(png)
        return path.relative_to(self.shots_root).as_posix()


def run(
    page: Any,
    start_link: str,
    model: Model,
    prompt: Prompt,
    recorder: Recorder,
    is_finished: Callable[[], bool],
    clock: Callable[[], float] = time.monotonic,
) -> Outcome:
    """Runs until I'm finished, give_up or a stop rule. Returns the termination reason.

    The caller ends the session with that reason unless it is completion_declared,
    which the web app records itself when the agent clicks I'm finished.
    """
    started = clock()
    page.goto(start_link)  # the start link is the only navigation the runner makes
    page.wait_for_timeout(SETTLE_MS)
    shot = page.screenshot()
    history: list[Action] = []
    recent: list[str] = []
    failures = 0
    step_no = 0
    labels: list[str] = []

    def outcome(reason: str) -> Outcome:
        return Outcome(reason, step_no, clock() - started, labels)

    while True:
        if step_no >= MAX_STEPS:
            return outcome("step_limit")
        if clock() - started >= MAX_SECONDS:
            return outcome("time_limit")

        # I'm finished ends the session through a request that can land after
        # the settle wait, so look again before asking the model.
        if history and is_finished():
            return outcome("completion_declared")

        step_no += 1
        shot_path = recorder.save_shot(step_no, shot)
        step: dict[str, Any] = {"stepNo": step_no, "screenshotPath": shot_path, "reason": None, "latencyMs": None}

        # Ask the model.
        asked = clock()
        raw: str | None = None
        try:
            raw = model.decide(prompt.instructions(), prompt.turn(history[-HISTORY:]), shot)
            step["latencyMs"] = int((clock() - asked) * 1000)
            action = parse_action(raw)
        except (ModelError, ActionError) as error:
            step["latencyMs"] = step["latencyMs"] or int((clock() - asked) * 1000)
            recorder.record_step(
                {**step, "action": {"error": str(error), "reply": raw}, "executed": False, "errorLabel": error.label}
            )
            labels.append(error.label)
            failures += 1
            if failures > MAX_RETRIES:
                return outcome("technical_error")
            continue

        step["reason"] = action.reason
        if action.kind == "give_up":
            recorder.record_step({**step, "action": action.as_json(), "executed": True, "errorLabel": None})
            return outcome("abandoned")

        # Perform it.
        try:
            execute(page, action)
            page.wait_for_timeout(SETTLE_MS)
            after = page.screenshot()
        except ActionError as error:
            recorder.record_step({**step, "action": action.as_json(), "executed": False, "errorLabel": error.label})
            labels.append(error.label)
            failures += 1
            if failures > MAX_RETRIES:
                return outcome("technical_error")
            continue
        except Exception as error:  # noqa: BLE001 - the screenshot itself failed
            recorder.record_step({**step, "action": action.as_json(), "executed": False, "errorLabel": "browser_error"})
            labels.append("browser_error")
            failures += 1
            if failures > MAX_RETRIES:
                return outcome("technical_error")
            shot = _safe_shot(page, shot)
            continue

        failures = 0
        # A click that changes nothing is flagged, but it is not a technical failure.
        unchanged = after == shot and action.kind != "wait"
        label = "no_visible_change" if unchanged else None
        if label:
            labels.append(label)
        recorder.record_step({**step, "action": action.as_json(), "executed": True, "errorLabel": label})
        history.append(action)
        shot = after

        if is_finished():
            return outcome("completion_declared")
        recent = (recent + [action.signature()])[-LOOP_LENGTH:]
        if len(recent) == LOOP_LENGTH and len(set(recent)) == 1:
            return outcome("loop")


def _safe_shot(page: Any, fallback: bytes) -> bytes:
    try:
        return page.screenshot()
    except Exception:  # noqa: BLE001
        return fallback
