import { browser, expect } from "@wdio/globals";
import { safeClick } from "../support/ui";
import { createAndSelectWorkspace } from "../support/workspace";

async function readZenAttribute(): Promise<string | null> {
  return (await browser.execute(() => {
    const main = document.querySelector(".app-main");
    return main ? main.getAttribute("data-zen") : null;
  })) as string | null;
}

describe("Zen mode", () => {
  it("toggles data-zen on the main panel from the status bar", async () => {
    const workspaceName = `E2E Zen ${Date.now()}`;
    await createAndSelectWorkspace({ name: workspaceName, targetPath: null });

    const initial = await readZenAttribute();
    expect(initial).toBe("false");

    await safeClick("[data-testid='zen-toggle']");
    await browser.waitUntil(async () => (await readZenAttribute()) === "true", {
      timeout: 10000,
      interval: 100,
    });

    await safeClick("[data-testid='zen-toggle']");
    await browser.waitUntil(async () => (await readZenAttribute()) === "false", {
      timeout: 10000,
      interval: 100,
    });
  });
});
