import { test, expect } from "@playwright/test";
import { resetAppState } from "./helpers";

test.describe("interchange / HCM operations module", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
    await page.goto("/interchange-ops");
  });

  test("defaults to the Conventional Diamond topology with computed LOS pills", async ({ page }) => {
    await expect(page.getByText("Interactive Schematic — Conventional Diamond")).toBeVisible();
    await expect(page.getByText(/MERGE [A-F]/)).toBeVisible();
    await expect(page.getByText(/WEAVE [A-F]/)).toBeVisible();
  });

  test("a ?topology= query param pre-selects that interchange preset", async ({ page }) => {
    await page.goto("/interchange-ops?topology=ddi");
    await expect(page.getByText("Interactive Schematic — Diverging Diamond Interchange")).toBeVisible();
  });

  test("increasing the ramp/mainline FFS differential raises merge density (turbulence penalty)", async ({ page }) => {
    const densityValue = page.getByTestId("ledger-value-density-d-r");
    const before = parseFloat((await densityValue.textContent()) ?? "0");
    await page.getByLabel("Ramp FFS").fill("25");
    await page.getByLabel("Mainline FFS").fill("75");
    const after = parseFloat((await densityValue.textContent()) ?? "0");
    expect(after).toBeGreaterThan(before);
  });

  test("D/D/1 queue chart and ledger render", async ({ page }) => {
    await expect(page.getByText("Peak Queue Q_max")).toBeVisible();
    await expect(page.getByText("D/D/1 Queue Buildup")).toBeVisible();
  });
});
