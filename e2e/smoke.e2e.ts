import { test, expect, Page } from "@playwright/test";

/** Console errors and uncaught exceptions collected during a test */
function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  return errors;
}

async function waitForScene(page: Page) {
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByText("Loading Solar System")).toHaveCount(0);
}

test("the scene loads without errors", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/");
  await waitForScene(page);
  await expect(page.getByRole("group", { name: "Time controls" })).toContainText("LIVE");
  await expect(page.getByRole("button", { name: "Mercury" }).first()).toBeAttached();
  expect(errors).toEqual([]);
});

test("a shared link opens the body's card", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/?body=saturn");
  await waitForScene(page);
  const panel = page.getByRole("complementary", { name: "Saturn details" });
  await expect(panel.getByRole("heading", { name: "Saturn" })).toBeVisible();
  await expect(panel.getByText("Light from it takes")).toBeVisible();
  expect(errors).toEqual([]);
});

test("exploring updates the URL and the back button walks back", async ({ page }) => {
  await page.goto("/");
  await waitForScene(page);
  await page.getByRole("button", { name: "Open explore panel" }).first().click();
  const panel = page.getByRole("complementary");
  await expect(panel.getByRole("heading", { name: "Sun" })).toBeVisible();

  await panel.getByRole("button", { name: "Jupiter", exact: true }).click();
  await expect(panel.getByRole("heading", { name: "Jupiter" })).toBeVisible();
  await expect(page).toHaveURL(/body=jupiter/);

  await panel.getByRole("button", { name: "Io", exact: true }).click();
  await expect(page).toHaveURL(/body=io/);

  await page.goBack();
  await expect(page).toHaveURL(/body=jupiter/);
  await expect(panel.getByRole("heading", { name: "Jupiter" })).toBeVisible();
});

test("time controls travel through time and back to now", async ({ page }) => {
  await page.goto("/");
  await waitForScene(page);
  const bar = page.getByRole("group", { name: "Time controls" });
  await bar.getByRole("button", { name: "Faster" }).click();
  await expect(bar).toContainText("1 min/s");
  await expect(bar.getByRole("button", { name: "Now" })).toBeVisible();
  await bar.getByRole("button", { name: "Now" }).click();
  await expect(bar).toContainText("LIVE");
});
