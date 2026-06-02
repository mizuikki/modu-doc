import { browser, expect } from "@wdio/globals";
import { safeClick, safeSetValue } from "../support/ui";
import { createAndSelectWorkspace } from "../support/workspace";

async function readZenAttribute(): Promise<string | null> {
  return (await browser.execute(() => {
    const main = document.querySelector(".app-main");
    return main ? main.getAttribute("data-zen") : null;
  })) as string | null;
}

describe("Command palette", () => {
  it("filters commands by query and toggles zen mode via Enter", async () => {
    const workspaceName = `E2E Palette ${Date.now()}`;
    await createAndSelectWorkspace({ name: workspaceName, targetPath: null });

    const beforeZen = await readZenAttribute();
    expect(beforeZen).toBe("false");

    await safeClick("[data-testid='header-more']");
    const palette = await $("[data-testid='command-palette']");
    await browser.waitUntil(async () => await palette.isExisting(), {
      timeout: 10000,
      interval: 100,
    });

    await safeSetValue("[data-testid='command-palette-input']", "zen");
    await browser.waitUntil(
      async () => await $("[data-testid='command-palette-item-toggle-zen']").isExisting(),
      { timeout: 10000, interval: 100 },
    );

    await safeClick("[data-testid='command-palette-item-toggle-zen']");
    await browser.waitUntil(async () => (await readZenAttribute()) === "true", {
      timeout: 10000,
      interval: 100,
    });

    await browser.waitUntil(async () => !(await palette.isExisting()), {
      timeout: 10000,
      interval: 100,
    });
  });
});
