import { browser, expect } from "@wdio/globals";
import { safeClick } from "../support/ui";
import { createAndOpenWorkspace } from "../support/workspace";

async function readZenAttribute(): Promise<string | null> {
  return (await browser.execute(() => {
    const main = document.querySelector(".app-main");
    return main ? main.getAttribute("data-zen") : null;
  })) as string | null;
}

describe("Zen mode", () => {
  it("toggles data-zen on the main panel from the status bar", async () => {
    // 1. Create a workspace so the status bar (and the zen-toggle in it)
    //    are rendered.
    const workspaceName = `E2E Zen ${Date.now()}`;
    await createAndOpenWorkspace(workspaceName);

    // 2. Sanity: data-zen starts as "false".
    const initial = await readZenAttribute();
    expect(initial).toBe("false");

    // 3. Click the status-bar zen toggle. The main panel reflects the new
    //    state via data-zen="true".
    await safeClick("[data-testid='zen-toggle']");
    await browser.waitUntil(async () => (await readZenAttribute()) === "true", {
      timeout: 10000,
      interval: 100,
    });

    // 4. Click again to exit zen mode.
    await safeClick("[data-testid='zen-toggle']");
    await browser.waitUntil(async () => (await readZenAttribute()) === "false", {
      timeout: 10000,
      interval: 100,
    });
  });
});
