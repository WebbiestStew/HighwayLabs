import { test, expect } from "@playwright/test";
import { resetAppState } from "./helpers";

test.describe("project manager (multi-project save/load)", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
    await page.goto("/overview");
  });

  test("shows Unsaved with no saved projects initially", async ({ page }) => {
    await expect(page.getByRole("button", { name: /project manager/i })).toContainText("Unsaved");
  });

  test("save as creates a named project and updates the trigger button", async ({ page }) => {
    await page.getByRole("button", { name: /project manager/i }).click();
    await page.getByPlaceholder("Project name…").fill("E2E Test Project");
    await page.getByRole("button", { name: "SAVE AS" }).click();

    await expect(page.getByText("SAVED PROJECTS (1)")).toBeVisible();
    await page.getByRole("button", { name: "Close" }).click();
    await expect(page.getByRole("button", { name: /project manager/i })).toContainText("E2E Test Project");
  });

  test("a saved project can be loaded and restores its unit system", async ({ page }) => {
    // Save with US units active.
    await page.getByRole("button", { name: /project manager/i }).click();
    await page.getByPlaceholder("Project name…").fill("US Baseline");
    await page.getByRole("button", { name: "SAVE AS" }).click();
    await page.getByRole("button", { name: "Close" }).click();

    // Switch to SI.
    await page.getByRole("button", { name: "SI", exact: true }).click();
    await expect(page.getByText(/1\+000\.000/).first()).toBeVisible();

    // Load the saved (US) project back.
    await page.getByRole("button", { name: /project manager/i }).click();
    await page.getByRole("button", { name: "LOAD" }).click();

    await expect(page.getByText(/10\+00\.00/).first()).toBeVisible();
  });

  test("new project resets the working state", async ({ page }) => {
    await page.getByRole("button", { name: "SI", exact: true }).click();
    await expect(page.getByText(/1\+000\.000/).first()).toBeVisible();

    await page.getByRole("button", { name: /project manager/i }).click();
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: /NEW PROJECT/ }).click();

    await expect(page.getByText(/10\+00\.00/).first()).toBeVisible();
  });

  test("deleting a saved project removes it from the list", async ({ page }) => {
    await page.getByRole("button", { name: /project manager/i }).click();
    await page.getByPlaceholder("Project name…").fill("To Delete");
    await page.getByRole("button", { name: "SAVE AS" }).click();
    await expect(page.getByText("SAVED PROJECTS (1)")).toBeVisible();

    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Delete To Delete" }).click();
    await expect(page.getByText("SAVED PROJECTS (0)")).toBeVisible();
  });
});
