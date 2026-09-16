import { test, expect } from "@playwright/test";
import { resetAppState } from "./helpers";

test.describe("pavement SN design module", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
    await page.goto("/pavement");
  });

  test("solves a required SN and renders the layered cross-section canvas", async ({ page }) => {
    await expect(page.getByTestId("ledger-value-sn-required")).toBeVisible();
    await expect(page.locator("canvas")).toBeVisible();
  });

  test("increasing design ESALs increases the required structural number", async ({ page }) => {
    const snRequired = page.getByTestId("ledger-value-sn-required");
    const before = parseFloat((await snRequired.textContent()) ?? "0");
    await page.getByLabel("Design ESALs (W18)").fill("50000000");
    const after = parseFloat((await snRequired.textContent()) ?? "0");
    expect(after).toBeGreaterThan(before);
  });

  test("reducing layer thicknesses below requirement flips the status pill to a structural deficit", async ({ page }) => {
    await page.getByLabel("Thickness D1").fill("1");
    await page.getByLabel("D2").fill("2");
    await page.getByLabel("D3").fill("1");
    await expect(page.getByText("STRUCTURAL DEFICIT")).toBeVisible();
  });
});
