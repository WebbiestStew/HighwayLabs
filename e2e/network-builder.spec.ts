import { test, expect } from "@playwright/test";
import { resetAppState } from "./helpers";

test.describe("network builder module", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
    await page.goto("/network-builder");
  });

  test("starts empty with zero mileage", async ({ page }) => {
    await expect(page.getByTestId("ledger-value-total-centerline-mileage")).toHaveText(/0\.00/);
  });

  test("drawing a freeway segment updates the mileage and node count", async ({ page }) => {
    const canvas = page.locator("canvas");
    const box = await canvas.boundingBox();
    if (!box) throw new Error("canvas not found");

    await canvas.click({ position: { x: box.width * 0.3, y: box.height * 0.5 } });
    await canvas.click({ position: { x: box.width * 0.7, y: box.height * 0.5 } });

    await expect(page.getByTestId("ledger-value-nodes")).toHaveText("2");
    const mileage = await page.getByTestId("ledger-value-total-centerline-mileage").textContent();
    expect(parseFloat(mileage ?? "0")).toBeGreaterThan(0);
  });

  test("placing an interchange stamp registers it and offers an HCM Ops analysis link", async ({ page }) => {
    await page.getByRole("button", { name: "Stamp" }).click();
    const canvas = page.locator("canvas");
    const box = await canvas.boundingBox();
    if (!box) throw new Error("canvas not found");
    await canvas.click({ position: { x: box.width / 2, y: box.height / 2 } });

    await expect(page.getByTestId("ledger-value-interchange-structures")).toHaveText("1");
    await expect(page.getByRole("link", { name: /ANALYZE IN HCM OPS/ })).toBeVisible();
  });

  test("undo removes the last placed element", async ({ page }) => {
    await page.getByRole("button", { name: "Stamp" }).click();
    const canvas = page.locator("canvas");
    const box = await canvas.boundingBox();
    if (!box) throw new Error("canvas not found");
    await canvas.click({ position: { x: box.width / 2, y: box.height / 2 } });
    await expect(page.getByTestId("ledger-value-interchange-structures")).toHaveText("1");

    await page.getByRole("button", { name: "UNDO (⌘Z)" }).click();
    await expect(page.getByTestId("ledger-value-interchange-structures")).toHaveText("0");
  });
});
