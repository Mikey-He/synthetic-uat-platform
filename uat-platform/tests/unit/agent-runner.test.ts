import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { TASK_TEXT } from "@/lib/domain/task";

// Build plan, Allowed and forbidden browser calls: the agent sees screenshots
// only. This fails the build if any forbidden call appears in agent-runner/.

const ROOT = path.join(process.cwd(), "agent-runner");
const SKIP = new Set([".venv", "runs", "__pycache__"]);

function pythonFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (SKIP.has(name)) return [];
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return pythonFiles(full);
    return name.endsWith(".py") ? [full] : [];
  });
}

// Any way to read the page other than a screenshot.
const FORBIDDEN: [string, RegExp][] = [
  ["page.content", /\.content\s*\(/],
  ["page.evaluate", /\.evaluate(_handle)?\s*\(/],
  ["locators", /\.locator\s*\(|\.get_by_\w+\s*\(|\.frame_locator\s*\(/],
  ["query selectors", /query_selector|\.\$\$?\s*\(|wait_for_selector|eval_on_selector/],
  ["element text", /\.(inner_text|inner_html|text_content|get_attribute|input_value)\s*\(/],
  ["accessibility snapshots", /accessibility|aria_snapshot/],
  ["network responses", /expect_response|expect_request|\.on\s*\(\s*["'](response|request|requestfinished)|\.route\s*\(/],
  ["page URL and title", /page\.url\b|\.title\s*\(/],
  ["frames and scripts", /\.frames?\b|add_init_script|expose_(binding|function)/],
];

describe("agent runner", () => {
  const files = pythonFiles(ROOT);

  it("has Python sources to check", () => {
    expect(files.some((file) => file.endsWith(path.join("runner", "loop.py")))).toBe(true);
  });

  it("makes no forbidden browser call", () => {
    const found = files.flatMap((file) => {
      const source = readFileSync(file, "utf8");
      return FORBIDDEN.filter(([, pattern]) => pattern.test(source)).map(
        ([name]) => `${path.relative(ROOT, file)}: ${name}`,
      );
    });
    expect(found).toEqual([]);
  });

  it("navigates only to the start link", () => {
    const runnerFiles = files.filter((file) => file.includes(`${path.sep}runner${path.sep}`));
    const gotos = runnerFiles.flatMap((file) => readFileSync(file, "utf8").match(/\.goto\s*\(/g) ?? []);
    expect(gotos).toHaveLength(1);
  });

  it("imports nothing from the web app", () => {
    for (const file of files) expect(readFileSync(file, "utf8"), file).not.toMatch(/uat-platform|\.\.\/lib|generated\/prisma/);
  });

  it("gives the model the task text word for word", () => {
    const task = readFileSync(path.join(ROOT, "prompts", "task-v1.txt"), "utf8").replace(/\r\n/g, "\n").trim();
    expect(task).toBe(TASK_TEXT);
  });

  it("describes personas as knowledge and habits, never as instructions to make mistakes", () => {
    const dir = path.join(ROOT, "personas");
    for (const name of readdirSync(dir)) {
      const text = readFileSync(path.join(dir, name), "utf8");
      expect(text, name).not.toMatch(/\bmistake|\berror|\bwrong|\bfail|\bmisread|\bforget/i);
    }
  });
});
