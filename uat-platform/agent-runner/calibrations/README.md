# Calibrations

This folder holds calibration configs, one Markdown file per ID. Each file contains text or examples derived from **calibration_A human sessions only** (build plan, Calibration slot).

The runner loads a file with `--calibration <id>` and records the ID on the session.

Freeze a file before any evaluation_B outcome is viewed. After that, never edit it. A change means a new file with a new ID.

Outcome-level corrections, such as adjusting predicted success rates, belong in analysis code, not here.
