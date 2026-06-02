import { browser, expect } from "@wdio/globals";
import { dismissWorkspaceStatus } from "../support/ui";
import { createAndSelectWorkspace } from "../support/workspace";

describe("Keyboard cheatsheet", () => {
  it("opens via ? and closes via Escape", async () => {
    const workspaceName = `E2E Cheatsheet ${Date.now()}`;
    await createAndSelectWorkspace({ name: workspaceName, targetPath: null });
    await dismissWorkspaceStatus();

    const cheatsheet = await $("[data-testid='keyboard-cheatsheet']");
    await browser.waitUntil(async () => !(await cheatsheet.isExisting()), {
      timeout: 10000,
      interval: 100,
    });

    await browser.keys(["?"]);
    await browser.waitUntil(async () => await cheatsheet.isExisting(), {
      timeout: 10000,
      interval: 100,
    });
    await expect($("[data-testid='keyboard-cheatsheet-list']")).toBeDisplayed();

    await browser.keys(["Escape"]);
    await browser.waitUntil(async () => !(await cheatsheet.isExisting()), {
      timeout: 10000,
      interval: 100,
    });
  });
});
