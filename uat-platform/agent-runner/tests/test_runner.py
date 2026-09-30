"""python -m unittest discover -s tests (from agent-runner/)."""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from runner.actions import ActionError, parse_action
from runner.loop import MAX_STEPS, Prompt, Recorder, run
from runner.model import ScriptedModel


FINISH = (1364, 22)  # where I'm finished sits in the task bar


class FakeMouse:
    def __init__(self, page: "FakePage"):
        self.page = page

    def click(self, x, y):
        self.page.calls.append(("click", x, y))
        self.page.version += 1
        if (x, y) == FINISH:
            self.page.finished = True  # the app ends the session

    def dblclick(self, x, y):
        self.page.calls.append(("dblclick", x, y))
        self.page.version += 1

    def move(self, x, y):
        self.page.calls.append(("move", x, y))

    def wheel(self, dx, dy):
        self.page.calls.append(("wheel", dx, dy))
        self.page.version += 1


class FakeKeyboard:
    def __init__(self, page: "FakePage"):
        self.page = page

    def type(self, text):
        self.page.calls.append(("type", text))
        self.page.version += 1

    def press(self, key):
        if key == "NotAKey":
            raise ValueError("Unknown key")
        self.page.calls.append(("press", key))
        self.page.version += 1


class FakePage:
    """Only the calls the runner is allowed to make exist here."""

    def __init__(self, frozen: bool = False):
        self.calls: list[tuple] = []
        self.version = 0
        self.frozen = frozen  # every screenshot looks the same
        self.finished = False
        self.mouse = FakeMouse(self)
        self.keyboard = FakeKeyboard(self)

    def goto(self, url):
        self.calls.append(("goto", url))

    def wait_for_timeout(self, ms):
        pass

    def screenshot(self):
        return b"png-0" if self.frozen else f"png-{self.version}".encode()


class FakeClock:
    def __init__(self, step: float = 0.0):
        self.now = 0.0
        self.step = step

    def __call__(self) -> float:
        self.now += self.step
        return self.now


def click(x=100, y=200, reason="try"):
    return json.dumps({"action": "click", "x": x, "y": y, "reason": reason})


PROMPT = Prompt(system="system", task="task", persona="persona")


class RunTest(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.steps: list[dict] = []
        self.recorder = Recorder(self.steps.append, self.tmp / "runs" / "s1", self.tmp)

    def run_with(self, replies, *, page=None, clock=None):
        page = page or FakePage()
        model = ScriptedModel(replies)
        outcome = run(page, "http://app/s/t/billing", model, PROMPT, self.recorder, lambda: page.finished, clock or FakeClock())
        return outcome, page, model

    def test_clicking_im_finished_ends_as_completion_declared(self):
        outcome, page, _ = self.run_with([click(), click(*FINISH)])
        self.assertEqual(outcome.termination_reason, "completion_declared")
        self.assertEqual([s["stepNo"] for s in self.steps], [1, 2])
        self.assertTrue(all(s["executed"] for s in self.steps))
        self.assertEqual(self.steps[1]["action"], {"action": "click", "x": 1364, "y": 22, "reason": "try"})
        self.assertEqual([c for c in page.calls if c[0] == "goto"], [("goto", "http://app/s/t/billing")])
        self.assertTrue((self.tmp / self.steps[0]["screenshotPath"]).exists())

    def test_a_finish_that_lands_late_still_ends_as_completion_declared(self):
        page = FakePage()
        checks = {"n": 0}

        def is_finished():  # false right after the click, true on the next look
            checks["n"] += 1
            return page.finished and checks["n"] > 2

        model = ScriptedModel([click(), click(*FINISH), click(9, 9)])
        outcome = run(page, "http://app/s/t/billing", model, PROMPT, self.recorder, is_finished, FakeClock())
        self.assertEqual(outcome.termination_reason, "completion_declared")
        self.assertEqual(len(model.turns), 2)  # the model was not asked again

    def test_give_up_is_recorded_and_ends_as_abandoned(self):
        outcome, _, _ = self.run_with([json.dumps({"action": "give_up", "reason": "lost"})])
        self.assertEqual(outcome.termination_reason, "abandoned")
        self.assertEqual(self.steps[0]["reason"], "lost")

    def test_three_failures_in_a_row_end_as_technical_error_with_labels(self):
        outcome, _, _ = self.run_with(["not json", click(5000, 10), "<timeout>"])
        self.assertEqual(outcome.termination_reason, "technical_error")
        self.assertEqual([s["errorLabel"] for s in self.steps], ["invalid_json", "out_of_bounds", "model_timeout"])
        self.assertFalse(any(s["executed"] for s in self.steps))

    def test_a_success_resets_the_retry_count(self):
        replies = ["bad", "bad", click(), "bad", "bad", json.dumps({"action": "give_up", "reason": "x"})]
        outcome, _, _ = self.run_with(replies)
        self.assertEqual(outcome.termination_reason, "abandoned")

    def test_an_unknown_key_is_a_browser_error(self):
        reply = json.dumps({"action": "key", "key": "NotAKey", "reason": "x"})
        outcome, _, _ = self.run_with([reply, reply, reply])
        self.assertEqual(outcome.termination_reason, "technical_error")
        self.assertEqual({s["errorLabel"] for s in self.steps}, {"browser_error"})

    def test_six_identical_actions_end_as_loop(self):
        outcome, _, _ = self.run_with([click()] * 10)
        self.assertEqual(outcome.termination_reason, "loop")
        self.assertEqual(outcome.steps, 6)

    def test_a_click_that_changes_nothing_is_flagged_but_not_a_failure(self):
        replies = [click(1, 1), click(2, 2), click(3, 3), click(4, 4), json.dumps({"action": "give_up", "reason": "x"})]
        outcome, _, _ = self.run_with(replies, page=FakePage(frozen=True))
        self.assertEqual(outcome.termination_reason, "abandoned")
        self.assertEqual([s["errorLabel"] for s in self.steps[:4]], ["no_visible_change"] * 4)
        self.assertTrue(all(s["executed"] for s in self.steps))

    def test_80_steps_end_as_step_limit(self):
        replies = [click(x % 1400, 100) for x in range(MAX_STEPS + 10)]
        outcome, _, _ = self.run_with(replies)
        self.assertEqual(outcome.termination_reason, "step_limit")
        self.assertEqual(len(self.steps), MAX_STEPS)

    def test_20_minutes_end_as_time_limit(self):
        replies = [click(x, 100) for x in range(50)]
        outcome, _, _ = self.run_with(replies, clock=FakeClock(step=60.0))
        self.assertEqual(outcome.termination_reason, "time_limit")

    def test_the_model_sees_the_task_and_its_last_five_actions(self):
        _, _, model = self.run_with([click(x, 1) for x in range(7)] + [json.dumps({"action": "give_up", "reason": "x"})])
        last = model.turns[-1]
        self.assertIn("task", last)
        self.assertIn('"x": 6', last)
        self.assertNotIn('"x": 1,', last)  # older than the last five


class ParseTest(unittest.TestCase):
    def test_reads_every_action(self):
        self.assertEqual(parse_action(click()).args, {"x": 100, "y": 200})
        self.assertEqual(parse_action('{"action":"scroll","dy":400.4,"reason":""}').args, {"dy": 400})
        self.assertEqual(parse_action('{"action":"type","text":"1000"}').reason, None)

    def test_labels_bad_replies(self):
        for raw, label in [
            ("nope", "invalid_json"),
            ("[]", "invalid_json"),
            ('{"action":"finish","reason":""}', "invalid_json"),
            ('{"action":"click","x":"a","y":1}', "invalid_json"),
            ('{"action":"type","text":""}', "invalid_json"),
            ('{"action":"click","x":1440,"y":1}', "out_of_bounds"),
            ('{"action":"click","x":10,"y":-1}', "out_of_bounds"),
        ]:
            with self.assertRaises(ActionError) as caught:
                parse_action(raw)
            self.assertEqual(caught.exception.label, label, raw)


if __name__ == "__main__":
    unittest.main()
