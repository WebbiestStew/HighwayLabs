import type { Page } from "@playwright/test";

/**
 * Playwright gives every test a fresh, isolated BrowserContext by default,
 * so localStorage already starts empty per test — no explicit reset needed.
 * (An earlier version of this helper used page.addInitScript() to clear
 * localStorage, but addInitScript re-runs before EVERY navigation within a
 * test, which silently wiped state set up by an earlier page.goto() in the
 * same test — e.g. a module's published corridor summary getting erased
 * right before navigating to the Overview page to check it.)
 */
export async function resetAppState(_page: Page) {
  // Intentionally a no-op — kept as a documented, explicit call site so a
  // test's intent ("start from a clean project") stays readable, without
  // reintroducing the cross-navigation clearing bug described above.
}

const consoleErrorAllowlist = [/hmr/i, /websocket/i, /Fast Refresh/i];

/** Attaches a console-error collector; call .assertNoErrors() at the end of a test. */
export function collectConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (consoleErrorAllowlist.some((re) => re.test(text))) return;
    errors.push(text);
  });
  page.on("pageerror", (err) => errors.push(err.message));
  return {
    errors,
    assertNoErrors() {
      if (errors.length > 0) {
        throw new Error(`Unexpected console errors:\n${errors.join("\n")}`);
      }
    },
  };
}
