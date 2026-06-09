import { browser, expect } from "@wdio/globals";
import { dismissDocumentStatus } from "../support/ui";
import { createAndOpenWorkspace } from "../support/workspace";

describe("Keyboard cheatsheet", () => {
  it("opens via ? and closes via Escape", async () => {
    // 1. Create a workspace so the app shell (and the cheatsheet shortcut
    //    hook) is fully mounted.
    const workspaceName = `E2E Cheatsheet ${Date.now()}`;
    await createAndOpenWorkspace(workspaceName);
    await dismissDocumentStatus();

    // 2. The cheatsheet should not be open initially.
    const cheatsheet = await $("[data-testid='keyboard-cheatsheet']");
    await browser.waitUntil(async () => !(await cheatsheet.isExisting()), {
      timeout: 10000,
      interval: 100,
    });

    // 3. Press "?" to open the cheatsheet. The content node + list should
    //    both become visible.
    await browser.keys(["?"]);
    await browser.waitUntil(async () => await cheatsheet.isExisting(), {
      timeout: 10000,
      interval: 100,
    });
    await expect($("[data-testid='keyboard-cheatsheet-list']")).toBeDisplayed();

    // 4. Press Escape to close.
    await browser.keys(["Escape"]);
    await browser.waitUntil(async () => !(await cheatsheet.isExisting()), {
      timeout: 10000,
      interval: 100,
    });
  });
});
