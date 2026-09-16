import { test, expect } from "@playwright/test";
import { resetAppState } from "./helpers";

test.describe("earthwork / mass-haul module", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
    await page.goto("/earthwork");
  });

  test("renders the default station ledger and mass-haul canvas", async ({ page }) => {
    await expect(page.getByRole("table")).toBeVisible();
    await expect(page.locator("canvas")).toBeVisible();
  });

  test("adding a station row increases the row count", async ({ page }) => {
    const before = await page.locator("table tbody tr").count();
    await page.getByRole("button", { name: "ADD STATION" }).click();
    await expect(page.locator("table tbody tr")).toHaveCount(before + 1);
  });

  test("switching to rock and increasing swell increases the adjusted cut credit", async ({ page }) => {
    const adjustedCredit = page.getByTestId("ledger-value-adjusted-cut-credit");
    const before = parseFloat(((await adjustedCredit.textContent()) ?? "0").replace(/,/g, ""));
    await page.getByRole("button", { name: "Rock", exact: true }).click();
    await page.getByLabel("Rock Swell Factor").fill("35");
    const after = parseFloat(((await adjustedCredit.textContent()) ?? "0").replace(/,/g, ""));
    expect(after).toBeGreaterThan(before);
  });

  test("dragging the balance line updates the balance level readout", async ({ page }) => {
    const canvas = page.locator("canvas");
    const box = await canvas.boundingBox();
    if (!box) throw new Error("canvas not found");
    const before = await page.getByLabel("Balance Level (drag on chart)").inputValue();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.3, { steps: 5 });
    await page.mouse.up();
    const after = await page.getByLabel("Balance Level (drag on chart)").inputValue();
    expect(after).not.toBe(before);
  });
});
