# agent-runner

This is the screenshot-only synthetic user for the budget task (milestone M7 in `docs/build-plan.md`). It is a Python loop. Each turn it shows the model one 1440 × 900 screenshot, together with:

- the task text,
- the persona,
- any frozen calibration text,
- the last five actions with their reasons.

It then performs the one action the model returns, using only the mouse and the keyboard. The agent sees the screenshots and nothing else.

By default the model is **`gemini-3.8-flash`**, Google's latest stable Gemini model as of 2026-09-30. It accepts image input and returns structured output.

The default prompt is `system-v2`. It asks for positions on a 0–1000 grid over the screenshot, because Gemini gives positions that way. The runner converts them to pixels. Each step stores both the clicked pixels (`x`, `y`) and the model's own numbers (`modelX`, `modelY`).

`system-v1` asked for pixels. Gemini answered on its 0–1000 grid anyway, so its clicks landed in the wrong places. Keep it only for comparison.

## Setup

Run these commands from `agent-runner/`:

```sh
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt   # macOS/Linux: .venv/bin/python
.venv/Scripts/python -m playwright install chromium
cp .env.example .env    # then fill in ADMIN_PASSWORD and GEMINI_API_KEY
```

The web app must be running at `UAT_BASE_URL`.

## Run

```sh
.venv/Scripts/python -m runner --persona medium-v1 --variant A
.venv/Scripts/python -m runner --persona low-v1 --variant B --runs 5 --temperature 0.4
```

Each run creates a synthetic session through the researcher console, with its model, prompt version, persona, calibration and variant. It prints one JSON line with the session ID and the termination reason.

Screenshots are saved to `runs/<session id>/step-NNN.png`. They are not committed.

Other options:

- `--model` picks a different Gemini model.
- `--calibration <id>` loads `calibrations/<id>.md`.
- `--headed` shows the browser window.
- `--script replies.json` replays a fixed list of actions instead of calling a model. Use it only to check the plumbing, never for study data.

## Stop rules

| Rule | Termination reason |
| --- | --- |
| The agent clicks I'm finished | completion_declared (recorded by the web app) |
| The agent returns give_up | abandoned |
| 80 steps are reached | step_limit |
| 20 minutes pass | time_limit |
| The same action comes six times in a row | loop |
| A model or browser failure happens three times running (two retries) | technical_error |

Each step is stored in AgentStep, including failed attempts. A failure is labelled invalid_json, out_of_bounds, model_timeout or browser_error. An API error from the model is recorded as model_timeout, the build plan's code for a failed model call.

A click after which the screenshot is unchanged is flagged no_visible_change. It still counts as executed and is not a technical failure.

## Rules

- The runner calls only `page.goto` (for the start link), `page.screenshot`, `page.mouse`, `page.keyboard` and `page.wait_for_timeout`.
- `tests/unit/agent-runner.test.ts` in the web app fails the build if any other page access appears here.
- The runner imports nothing from the web app. `prompts/task-v1.txt` is a copy of the task text, and the same test checks that it matches word for word.
- The researcher console is used only from the runner's own HTTP client, never from the agent's browser.

## Tests

```sh
.venv/Scripts/python -m unittest discover -s tests -t .
```

## Files

| Path | What it holds |
| --- | --- |
| `prompts/system-v2.md` | How the agent sees and acts, with 0–1000 coordinates (the default) |
| `prompts/system-v1.md` | The first version, which asked for pixel coordinates |
| `prompts/task-v1.txt` | The task text, word for word |
| `personas/*-v1.md` | Low, medium and high familiarity. Each describes knowledge and habits, never instructions to make mistakes. |
| `calibrations/` | Frozen calibration texts, loaded by ID (none yet) |
| `runner/` | The loop, the actions, the model client and the console client |
