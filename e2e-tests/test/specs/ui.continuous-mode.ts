import { browser, expect } from "@wdio/globals";
import { safeClick } from "../support/ui";
import { createAndSelectWorkspace } from "../support/workspace";

describe("Continuous editor mode", () => {
  it("switches from fragment to continuous mode", async () => {
    const workspaceName = `E2E Continuous ${Date.now()}`;
    await createAndSelectWorkspace({ name: workspaceName, targetPath: null });

    await browser.waitUntil(async () => await $("[data-testid='mode-fragment']").isExisting(), {
      timeout: 10000,
      interval: 100,
    });

    const fragmentButton = await $("[data-testid='mode-fragment']");
    expect(await fragmentButton.getAttribute("aria-pressed")).toBe("true");

    await safeClick("[data-testid='mode-continuous']");
    await browser.waitUntil(async () => await $("[data-testid='continuous-editor']").isExisting(), {
      timeout: 10000,
      interval: 100,
    });

    const continuousButton = await $("[data-testid='mode-continuous']");
    expect(await continuousButton.getAttribute("aria-pressed")).toBe("true");
  });
});
