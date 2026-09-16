import { test, expect } from "@playwright/test";
import { resetAppState } from "./helpers";

test.describe("project overview module", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  test("shows all six modules as not-set-up on a fresh project", async ({ page }) => {
    await page.goto("/overview");
    await expect(page.getByText("0/6 MODULES CONFIGURED")).toBeVisible();
    await expect(page.getByText("NOT SET UP")).toHaveCount(6);
  });

  test("configuring the horizontal alignment module publishes it to the corridor overview", async ({ page }) => {
    await page.goto("/horizontal-alignment");
    // Wait for the module to actually compute and publish its summary to the
    // corridor store (a useEffect keyed on the results) before navigating away.
    await expect(page.getByText("R ≥ R_MIN — CONFORMING")).toBeVisible();
    await page.goto("/overview");
    await expect(page.getByText("1/6 MODULES CONFIGURED")).toBeVisible();
    await expect(page.getByRole("heading", { name: "01 · Horizontal Alignment" })).toBeVisible();
    await expect(page.getByText("TS", { exact: true }).first()).toBeVisible();
  });

  test("Open Module links route to the correct page", async ({ page }) => {
    await page.goto("/overview");
    await page.getByRole("link", { name: "Open Module" }).first().click();
    await expect(page).toHaveURL(/horizontal-alignment$/);
  });
});
