import { test, expect } from "@playwright/test";
import { resetAppState } from "./helpers";

test.describe("vertical alignment module", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
    await page.goto("/vertical-alignment");
  });

  test("defaults to a conforming crest curve with a clearance deficit flagged", async ({ page }) => {
    await expect(page.getByText("K ≥ K_MIN — CONFORMING")).toBeVisible();
    await expect(page.getByText("CLEARANCE DEFICIT")).toBeVisible();
  });

  test("unchecking the structure toggle removes the clearance status pill", async ({ page }) => {
    await page.getByText("Critical structure present").click();
    await expect(page.getByText("CLEARANCE DEFICIT")).not.toBeVisible();
  });

  test("switching to sag class and enabling the curbed-urban check shows the K<=167 row", async ({ page }) => {
    await page.getByRole("button", { name: "Sag", exact: true }).click();
    await page.getByText("Curbed urban section").click();
    await expect(page.getByText("Drainage Flatness (K≤167)")).toBeVisible();
  });

  test("an under-length manual curve is flagged non-conforming", async ({ page }) => {
    await page.getByRole("button", { name: "Manual", exact: true }).click();
    await page.getByLabel("Curve Length L").fill("10");
    await expect(page.getByText("K < K_MIN — VIOLATION")).toBeVisible();
  });

  test("the coordinate canvas renders", async ({ page }) => {
    await expect(page.locator("canvas")).toBeVisible();
  });
});
