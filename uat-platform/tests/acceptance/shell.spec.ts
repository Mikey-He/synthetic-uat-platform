import { expect, test } from "@playwright/test";

const TOKEN = "dev-a";

const ROUTES = [
  "",
  "/billing",
  "/billing/budgets",
  "/billing/budgets/create",
  "/billing/budgets/example",
  "/billing/account",
  "/stub/reports",
  "/stub/notification-channels",
  "/done",
];

for (const route of ROUTES) {
  test(`/s/${TOKEN}${route} renders cleanly and every visible link works`, async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));

    const response = await page.goto(`/s/${TOKEN}${route}`);
    expect(response?.status()).toBe(200);
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveTitle("Cloud Console (prototype)");

    // Light DOM only, so framework dev tooling inside shadow roots is not counted.
    const hrefs = await page.evaluate(() =>
      Array.from(document.querySelectorAll("a"))
        .filter((a) => a.checkVisibility())
        .map((a) => a.getAttribute("href") ?? ""),
    );
    for (const href of hrefs) {
      expect(href, "a link needs a real target").not.toMatch(/^(#.*)?$/);
      const linked = await page.request.get(href);
      expect(linked.status(), href).toBe(200);
    }
    expect(errors).toEqual([]);
  });
}

test("task bar shows the whole task and keeps fixed heights", async ({ page }) => {
  await page.goto(`/s/${TOKEN}/billing`);
  const bar = page.getByRole("button", { name: "I'm finished" }).locator("xpath=..");

  expect((await bar.boundingBox())?.height).toBe(136);
  const lastParagraph = await page
    .getByText("Save your settings and indicate when you have finished.")
    .boundingBox();
  expect(lastParagraph!.y + lastParagraph!.height).toBeLessThanOrEqual(136);

  await page.getByRole("button", { name: "Collapse task" }).click();
  expect((await bar.boundingBox())?.height).toBe(44);
  await page.getByRole("button", { name: "Expand task" }).click();
  expect((await bar.boundingBox())?.height).toBe(136);
});

test("I'm finished goes to the done page", async ({ page }) => {
  await page.goto(`/s/${TOKEN}/billing`);
  await page.getByRole("button", { name: "I'm finished" }).click();
  await expect(page).toHaveURL(new RegExp(`/s/${TOKEN}/done$`));
});

test("viewport gate covers small windows and lifts once the window is large enough", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.goto(`/s/${TOKEN}/billing`);
  await expect(
    page.getByText(
      "Please make this window larger. It needs to be at least 1440 by 900. Current size is 1200 by 800.",
    ),
  ).toBeVisible();

  await page.setViewportSize({ width: 1440, height: 800 });
  await expect(page.getByText("Current size is 1440 by 800.")).toBeVisible();

  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.getByText("Please make this window larger.")).toHaveCount(0);
});
