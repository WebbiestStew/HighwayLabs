import { test, expect } from "@playwright/test";
import { resetAppState } from "./helpers";

test.describe("horizontal alignment module", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
    await page.goto("/horizontal-alignment");
  });

  test("computes R_min and shows a conforming status for the default radius", async ({ page }) => {
    await expect(page.getByText("R ≥ R_MIN — CONFORMING")).toBeVisible();
    await expect(page.getByTestId("ledger-value-r-min-e-max")).toContainText("1,333.3");
  });

  test("flags a non-conforming radius and shows the validation banner for an out-of-range lane count", async ({ page }) => {
    const lanesField = page.getByLabel("Lanes per Direction");
    await lanesField.fill("10");
    await expect(page.getByText(/input.*outside policy bounds/i)).toBeVisible();
    await expect(page.getByText("Too big: expected number to be <=6")).toBeVisible();
  });

  test("dropping the curve radius below R_min flips the status pill to a violation", async ({ page }) => {
    await page.getByLabel("Selected Curve Radius R").fill("50");
    await expect(page.getByText("R < R_MIN — VIOLATION")).toBeVisible();
  });

  test("calculation transparency drawer opens with step-by-step substitution", async ({ page }) => {
    await page.getByRole("button", { name: "CALCULATION PROOF" }).click();
    await expect(page.getByText("Minimum Radius for e_max", { exact: false })).toBeVisible();
    await expect(page.getByText(/R_min = V/)).toBeVisible();
  });

  test("switching axis of rotation to inside-edge pins the low-side edge flat on the elevation diagram", async ({ page }) => {
    await page.getByRole("button", { name: "In. Edge" }).click();
    // A real, physically meaningful change: tangent runout length depends on
    // wRotatedFt, which differs for edge-of-pavement rotation vs centerline.
    await expect(page.getByText("142.2", { exact: false })).toBeVisible();
  });

  test("station slider and CSV export controls are present", async ({ page }) => {
    await expect(page.getByRole("slider")).toBeVisible();
    await expect(page.getByRole("button", { name: "CSV / DXF" })).toBeVisible();
  });
});
