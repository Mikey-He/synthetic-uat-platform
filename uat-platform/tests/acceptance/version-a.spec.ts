import { expect, test, type Page } from "@playwright/test";
import { db } from "@/lib/db";

const TOKEN = "dev-a";

// Step 4 runs on the shared dev token, so each test starts from an empty record.
test.beforeEach(async () => {
  await db.evaluation.deleteMany({ where: { token: TOKEN } });
  await db.budget.deleteMany({ where: { token: TOKEN } });
  await db.budgetDraft.deleteMany({ where: { token: TOKEN } });
});

test.afterAll(async () => {
  await db.$disconnect();
});

async function openCreateForm(page: Page) {
  await page.goto(`/s/${TOKEN}/billing/budgets`);
  await page.getByRole("link", { name: "Create budget" }).click();
  await expect(page.getByRole("heading", { name: "Create budget" })).toBeVisible();
}

test("a person saves the correct Atlas budget by clicking, and reopens it", async ({ page }) => {
  await openCreateForm(page);

  // 1 Define
  await page.getByLabel("Name", { exact: true }).fill("Atlas monthly");
  await page.getByRole("button", { name: "Next", exact: true }).click();

  // 2 Scope: the time range stays Monthly; the projects go from all to Atlas only
  const projects = page.getByRole("button", { name: /^Projects/ });
  await expect(projects).toContainText("All projects");
  await projects.click();
  await page.getByRole("checkbox", { name: "Select all" }).uncheck();
  await page.getByRole("checkbox", { name: "Atlas", exact: true }).check();
  await page.keyboard.press("Escape");
  await expect(projects).toHaveText("Atlas");
  await page.getByRole("button", { name: "Next", exact: true }).click();

  // 3 Amount
  await page.getByLabel("Target amount").fill("1000");
  await page.getByRole("button", { name: "Next", exact: true }).click();

  // 4 Actions: first rule to 80% actual, alert only the project owner
  await page.getByRole("textbox", { name: "Percent of budget" }).first().fill("80");
  await page.getByRole("checkbox", { name: "Email alerts to billing admins and users" }).uncheck();
  await page.getByRole("checkbox", { name: /Email alerts to project owners/ }).check();

  await page.getByRole("button", { name: "Finish", exact: true }).click();
  await expect(page).toHaveURL(/\/billing\/budgets\/[0-9a-f-]{36}$/);

  // Saved view shows the saved values
  await expect(page.getByRole("heading", { name: "Atlas monthly" })).toBeVisible();
  const main = page.locator("main");
  for (const text of ["Monthly", "Atlas", "Specified amount", "$1,000.00", "80%", "$800.00"]) {
    await expect(main).toContainText(text);
  }
  await expect(
    page.getByRole("checkbox", { name: "Email alerts to billing admins and users" }),
  ).not.toBeChecked();
  await expect(page.getByRole("checkbox", { name: /Email alerts to project owners/ })).toBeChecked();

  // The stored evaluation passes every criterion
  const evaluation = await db.evaluation.findFirst({
    where: { token: TOKEN },
    orderBy: { createdAt: "desc" },
  });
  expect(evaluation?.overallSuccess).toBe(true);
  expect(evaluation?.criteria).toEqual({
    scope: true,
    period: true,
    amount: true,
    alert: true,
    recipients: true,
    persistence: true,
  });

  // Reopen: the create form loads the saved values
  await page.getByRole("link", { name: "Edit" }).click();
  await expect(page.getByRole("heading", { name: "Create budget" })).toBeVisible();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Atlas monthly");
  await page.getByRole("button", { name: /Scope/ }).click();
  await expect(page.getByRole("button", { name: /^Projects/ })).toHaveText("Atlas");
  await page.getByRole("button", { name: /Amount/ }).click();
  await expect(page.getByLabel("Target amount")).toHaveValue("1000");
  await page.getByRole("button", { name: /Actions/ }).click();
  await expect(page.getByRole("textbox", { name: "Percent of budget" }).first()).toHaveValue("80");
  await expect(page.getByRole("checkbox", { name: /Email alerts to project owners/ })).toBeChecked();

  // Saving again writes a new version of the same budget
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  await expect(page).toHaveURL(/\/billing\/budgets\/[0-9a-f-]{36}$/);
  const versions = await db.budget.findMany({ where: { token: TOKEN }, orderBy: { version: "asc" } });
  expect(versions.map((row) => row.version)).toEqual([1, 2]);
  expect(new Set(versions.map((row) => row.id)).size).toBe(1);
});

test("the draft survives a reload", async ({ page }) => {
  await openCreateForm(page);
  await page.getByLabel("Name", { exact: true }).fill("Draft only");
  await expect
    .poll(async () => (await db.budgetDraft.findUnique({ where: { token: TOKEN } }))?.draft)
    .toMatchObject({ config: { name: "Draft only" } });
  await page.reload();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Draft only");
});

test("a missing name shows validation and nothing is saved", async ({ page }) => {
  await openCreateForm(page);
  await page.getByRole("button", { name: /Actions/ }).click();
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  await expect(page.getByText("Enter a budget name.")).toBeVisible();
  await expect(page.getByLabel("Name", { exact: true })).toBeVisible();
  expect(await db.budget.count({ where: { token: TOKEN } })).toBe(0);
});
