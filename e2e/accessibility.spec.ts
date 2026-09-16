import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { resetAppState } from "./helpers";

const ROUTES = ["/start", "/overview", "/horizontal-alignment", "/vertical-alignment", "/interchange-ops", "/earthwork", "/pavement", "/network-builder"];

test.describe("accessibility (axe-core)", () => {
  for (const route of ROUTES) {
    test(`${route} has no critical or serious a11y violations`, async ({ page }) => {
      await resetAppState(page);
      await page.goto(route);
      await page.waitForLoadState("networkidle");

      const results = await new AxeBuilder({ page })
        // Canvas-rendered engineering diagrams are not meaningfully describable
        // via alt text at this density; they're paired with text ledgers that
        // carry the same information, so this check is scoped out deliberately
        // rather than silently failing on every module page.
        .exclude("canvas")
        .analyze();

      const blocking = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
      if (blocking.length > 0) {
        const summary = blocking
          .map((v) => `${v.impact?.toUpperCase()} ${v.id}: ${v.help} (${v.nodes.length} node(s))\n  ${v.helpUrl}`)
          .join("\n");
        throw new Error(`Accessibility violations on ${route}:\n${summary}`);
      }
      expect(blocking).toHaveLength(0);
    });
  }
});
