import { test, expect } from "@playwright/test";
import { resetAppState, collectConsoleErrors } from "./helpers";

const ROUTES = [
  { path: "/overview", heading: "Corridor Station Overview" },
  { path: "/horizontal-alignment", heading: "Superelevation Engineering Ledger" },
  { path: "/vertical-alignment", heading: "Vertical Curve Engineering Ledger" },
  { path: "/interchange-ops", heading: /Interactive Schematic/ },
  { path: "/earthwork", heading: "Station Cross-Section Ledger" },
  { path: "/pavement", heading: "Structural Design Ledger" },
  { path: "/network-builder", heading: "Network Statistics" },
];

test.describe("navigation and page load", () => {
  for (const route of ROUTES) {
    test(`${route.path} loads without console errors`, async ({ page }) => {
      const consoleTracker = collectConsoleErrors(page);
      await resetAppState(page);
      await page.goto(route.path);
      await expect(page.getByText(route.heading).first()).toBeVisible({ timeout: 10_000 });
      consoleTracker.assertNoErrors();
    });
  }

  test("root redirects to the start screen on a fresh project", async ({ page }) => {
    await resetAppState(page);
    await page.goto("/");
    await expect(page).toHaveURL(/\/start$/);
  });

  test("root redirects to the project overview once a project exists", async ({ page }) => {
    await resetAppState(page);
    await page.goto("/horizontal-alignment"); // creates highwaylab.project via first store access
    await page.goto("/");
    await expect(page).toHaveURL(/\/overview$/);
  });

  test("tab bar links navigate to every module", async ({ page }) => {
    await resetAppState(page);
    await page.goto("/overview");
    for (const route of ROUTES) {
      await page.locator(`nav a[href="${route.path}"]`).click();
      await expect(page).toHaveURL(new RegExp(route.path.replace(/\//g, "\\/") + "$"));
    }
  });

  test("US/SI unit toggle switches station formatting", async ({ page }) => {
    await resetAppState(page);
    await page.goto("/overview");
    await expect(page.getByText(/10\+00\.00/).first()).toBeVisible();
    await page.getByRole("button", { name: "SI", exact: true }).click();
    await expect(page.getByText(/1\+000\.000/).first()).toBeVisible();
  });

  test("AASHTO/TxDOT governing standard toggle (in project settings) updates the calc drawer citation", async ({ page }) => {
    await resetAppState(page);
    await page.goto("/horizontal-alignment");
    await page.getByRole("button", { name: "Project Settings" }).click();
    await page.getByRole("button", { name: "TxDOT RDM", exact: true }).click();
    await page.getByRole("button", { name: "Close" }).click();
    await page.getByRole("button", { name: "CALCULATION PROOF" }).click();
    await expect(page.getByText(/GOVERNING STANDARD: TxDOT Roadway Design Manual/i)).toBeVisible();
  });
});
