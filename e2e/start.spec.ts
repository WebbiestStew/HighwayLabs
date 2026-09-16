import { test, expect } from "@playwright/test";
import { resetAppState } from "./helpers";

test.describe("start screen", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
    await page.goto("/start");
  });

  test("shows the three entry cards", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "New Project" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Open Saved Project" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Load Demo Corridor" })).toBeVisible();
  });

  test("New Project creates a project with the given parameters and lands on Overview", async ({ page }) => {
    await page.getByRole("heading", { name: "New Project" }).click();
    const form = page.locator("div").filter({ has: page.getByText("New Project", { exact: true }) }).last();
    await form.getByLabel("Corridor Name").fill("Test Corridor E2E");
    await form.getByLabel("Design Speed").fill("55");
    await form.getByRole("button", { name: "Create" }).click();

    await expect(page).toHaveURL(/\/overview$/);
    await expect(page.getByText("Test Corridor E2E")).toBeVisible();
    await expect(page.getByText("Design speed 55 mph")).toBeVisible();
  });

  test("Open Saved Project shows an empty state with no saved projects", async ({ page }) => {
    await page.getByRole("heading", { name: "Open Saved Project" }).click();
    await expect(page.getByText("No saved projects yet.")).toBeVisible();
  });

  test("Load Demo Corridor populates all six modules on the Overview dashboard", async ({ page }) => {
    await page.getByRole("heading", { name: "Load Demo Corridor" }).click();
    await expect(page).toHaveURL(/\/overview$/);
    await expect(page.getByText("6/6 MODULES CONFIGURED")).toBeVisible();
    await expect(page.getByRole("heading", { name: "01 · Horizontal Alignment" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "06 · Network Builder" })).toBeVisible();
  });

  test("the HighwayLab logo returns to the start screen from any module", async ({ page }) => {
    await page.getByRole("heading", { name: "Load Demo Corridor" }).click();
    await expect(page).toHaveURL(/\/overview$/);
    await page.getByRole("link", { name: "Back to start screen" }).click();
    await expect(page).toHaveURL(/\/start$/);
  });
});
