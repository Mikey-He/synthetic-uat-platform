"""python -m runner --persona medium-v1 --variant A

Creates a synthetic session through the researcher console, opens its link in
a 1440 x 900 browser at scale factor 1, and lets the model work until it
clicks I'm finished, gives up or hits a stop rule.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from playwright.sync_api import sync_playwright

from .console import ResearchConsole
from .loop import Prompt, Recorder, run
from .model import DEFAULT_MODEL, GeminiModel, Model, ScriptedModel

ROOT = Path(__file__).resolve().parent.parent
PERSONAS = ("low-v1", "medium-v1", "high-v1")
# The coordinate grid each system prompt asks for. system-v1 asked for pixels,
# which Gemini does not follow: it gives positions on a 0-1000 grid.
PROMPT_COORDINATES = {"system-v1": None, "system-v2": 1000}


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="runner", description=__doc__)
    parser.add_argument("--persona", choices=PERSONAS, required=True)
    parser.add_argument("--variant", choices=("A", "B"), required=True)
    parser.add_argument("--model", default=DEFAULT_MODEL, help=f"Gemini model ID (default {DEFAULT_MODEL})")
    parser.add_argument("--prompt-version", choices=tuple(PROMPT_COORDINATES), default="system-v2")
    parser.add_argument("--calibration", default=None, help="ID of a frozen file in calibrations/")
    parser.add_argument("--temperature", type=float, default=None)
    parser.add_argument("--runs", type=int, default=1)
    parser.add_argument("--headed", action="store_true", help="show the browser window")
    parser.add_argument(
        "--script",
        type=Path,
        default=None,
        help="replay the JSON list of replies in this file instead of calling a model (plumbing check only)",
    )
    args = parser.parse_args(argv)

    load_dotenv(ROOT / ".env")
    base_url = os.environ.get("UAT_BASE_URL", "http://localhost:3000")
    password = os.environ.get("ADMIN_PASSWORD", "")
    prompt = Prompt(
        system=read(ROOT / "prompts" / f"{args.prompt_version}.md"),
        task=read(ROOT / "prompts" / "task-v1.txt"),
        persona=read(ROOT / "personas" / f"{args.persona}.md"),
        calibration=read(ROOT / "calibrations" / f"{args.calibration}.md") if args.calibration else None,
        coordinate_scale=PROMPT_COORDINATES[args.prompt_version],
    )

    console = ResearchConsole(base_url, password)
    for _ in range(args.runs):
        model: Model
        if args.script:
            # Each reply is an action object, or a raw string to test bad replies.
            replies = [r if isinstance(r, str) else json.dumps(r) for r in json.loads(read(args.script))]
            model = ScriptedModel(replies, model_id=f"scripted:{args.script.name}")
        else:
            key = os.environ.get("GEMINI_API_KEY", "")
            if not key:
                print("GEMINI_API_KEY is not set in agent-runner/.env.", file=sys.stderr)
                return 2
            model = GeminiModel(key, args.model, args.temperature)

        session = console.create_session(
            model_id=model.model_id,
            prompt_version=args.prompt_version,
            persona_id=args.persona,
            calibration_id=args.calibration,
            variant=args.variant,
            temperature=args.temperature,
        )
        recorder = Recorder(
            record_step=lambda step, sid=session.id: console.record_step(sid, step),
            shots_dir=ROOT / "runs" / session.id,
            shots_root=ROOT,
        )
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=not args.headed)
            context = browser.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=1)
            page = context.new_page()
            try:
                outcome = run(
                    page,
                    session.link,
                    model,
                    prompt,
                    recorder,
                    is_finished=lambda sid=session.id: console.status(sid)["ended"],
                )
            finally:
                browser.close()

        reason = outcome.termination_reason
        if reason != "completion_declared":
            reason = console.end(session.id, reason)
        print(
            json.dumps(
                {
                    "sessionId": session.id,
                    "variant": session.variant,
                    "model": model.model_id,
                    "persona": args.persona,
                    "terminationReason": reason,
                    "steps": outcome.steps,
                    "seconds": round(outcome.seconds, 1),
                }
            )
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
