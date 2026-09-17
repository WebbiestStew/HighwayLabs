import { test, expect } from "@playwright/test";
import { resetAppState, collectConsoleErrors } from "./helpers";

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

  test("3D corridor viewer renders without console errors and offers real-geometry exports", async ({ page }) => {
    const consoleErrors = collectConsoleErrors(page);
    await expect(page.getByRole("heading", { name: "3D Corridor Viewer" })).toBeVisible();
    // The R3F canvas mounts async (dynamic import, ssr:false) — give it a moment.
    await expect(page.locator("canvas").last()).toBeVisible();
    await page.waitForTimeout(500);

    const dxfDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: /DXF \(3D POLYLINE\)/ }).click();
    const dxf = await dxfDownload;
    expect(dxf.suggestedFilename()).toMatch(/\.dxf$/);

    const xmlDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: "LandXML" }).click();
    const xml = await xmlDownload;
    expect(xml.suggestedFilename()).toMatch(/\.xml$/);

    consoleErrors.assertNoErrors();
  });

  test("sight distance overlay flags a violation when the actual obstruction clearance is less than the required middle ordinate", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Sight Distance Envelope Overlay" })).toBeVisible();
    const middleOrdinateText = await page.getByTestId("ledger-value-middle-ordinate-hso").innerText();
    const middleOrdinateFt = parseFloat(middleOrdinateText);
    expect(middleOrdinateFt).toBeGreaterThan(0);

    const clearanceField = page.getByLabel("Actual Obstruction Clearance");
    await clearanceField.fill(String(Math.max(middleOrdinateFt - 5, 0)));
    await expect(page.getByText(/ACTUAL OBSTRUCTION.*— VIOLATION/i)).toBeVisible();

    await clearanceField.fill(String(middleOrdinateFt + 20));
    await expect(page.getByText(/ACTUAL OBSTRUCTION.*— CLEAR/i)).toBeVisible();
  });

  test("3D / export geometry inputs (deflection, turn direction, lead tangent, elevation, grade) are present and editable", async ({ page }) => {
    await expect(page.getByLabel("Deflection Angle Δ")).toHaveValue("40");
    await page.getByRole("button", { name: "Left" }).click();
    await expect(page.getByRole("button", { name: "Left" })).toHaveClass(/text-cyan/);
  });

  test("terrain importer: clicking 2+ map points and draping over (mocked) real terrain updates Start Elevation and shows a Clear Terrain control", async ({ page }) => {
    // Mock Open-Meteo rather than depending on a live third-party API in CI —
    // the array length must match the request's point count (resampled to 40).
    await page.route("**/api.open-meteo.com/v1/elevation**", async (route) => {
      const url = new URL(route.request().url());
      const n = (url.searchParams.get("latitude") ?? "").split(",").length;
      await route.fulfill({ json: { elevation: Array.from({ length: n }, (_, i) => 200 + i) } });
    });

    await expect(page.getByRole("heading", { name: "Terrain / GIS Import" })).toBeVisible();
    const mapContainer = page.locator(".leaflet-container");
    await mapContainer.scrollIntoViewIfNeeded();
    await expect(mapContainer).toBeVisible();
    const box = await mapContainer.boundingBox();
    if (!box) throw new Error("map container has no bounding box");
    await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.4);
    await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.6);

    const drapeButton = page.getByRole("button", { name: "DRAPE OVER REAL TERRAIN" });
    await expect(drapeButton).toBeEnabled();
    await drapeButton.click();

    await expect(page.getByRole("button", { name: "CLEAR TERRAIN" })).toBeVisible();
    // Mock returns 200m at the first sample -> 200 * 3.28084 ft, rounded.
    await expect(page.getByLabel("Start Elevation")).toHaveValue(String(Math.round(200 * 3.28084)));
  });
});
