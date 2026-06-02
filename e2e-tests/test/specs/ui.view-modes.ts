import { browser, expect } from "@wdio/globals";
import { safeClick } from "../support/ui";
import { createAndSelectWorkspace } from "../support/workspace";

async function isViewModeActive(mode: "write" | "split" | "read"): Promise<boolean> {
  const button = await $(`[data-testid='view-mode-${mode}']`);
  if (!(await button.isExisting())) return false;
  const pressed = await button.getAttribute("aria-pressed");
  return pressed === "true";
}

describe("View modes", () => {
  it("switches between write, split, and read layouts", async () => {
    const workspaceName = `E2E ViewModes ${Date.now()}`;
    await createAndSelectWorkspace({ name: workspaceName, targetPath: null });

    await browser.waitUntil(async () => (await $("[data-testid='view-mode-write']")).isExisting(), {
      timeout: 20000,
      interval: 200,
    });

    await safeClick("[data-testid='view-mode-read']");
    await browser.waitUntil(async () => isViewModeActive("read"), {
      timeout: 10000,
      interval: 100,
    });
    const readFragmentPreview = await $("[data-testid='fragments-new']");
    expect(await readFragmentPreview.isExisting()).toBe(true);

    await safeClick("[data-testid='view-mode-split']");
    await browser.waitUntil(async () => isViewModeActive("split"), {
      timeout: 10000,
      interval: 100,
    });
    const splitPane = await $("#main-split-pane");
    await browser.waitUntil(async () => await splitPane.isExisting(), {
      timeout: 10000,
      interval: 100,
    });

    await safeClick("[data-testid='view-mode-write']");
    await browser.waitUntil(async () => isViewModeActive("write"), {
      timeout: 10000,
      interval: 100,
    });
    await browser.waitUntil(async () => await $("[data-testid='fragment-editor']").isExisting(), {
      timeout: 10000,
      interval: 100,
    });
  });
});
