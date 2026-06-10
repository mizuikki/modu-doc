import { browser, expect } from "@wdio/globals";
import { createAndOpenProject } from "../support/project";
import { safeClick, safeSetValue } from "../support/ui";

async function readZenAttribute(): Promise<string | null> {
  return (await browser.execute(() => {
    const main = document.querySelector(".app-main");
    return main ? main.getAttribute("data-zen") : null;
  })) as string | null;
}

describe("Command palette", () => {
  it("filters commands by query and toggles zen mode via the palette", async () => {
    // 1. Create a fresh project so the palette has the standard document
    //    commands (new-document, focus-document, create-snapshot, toggle-zen)
    //    registered.
    const projectName = `E2E Palette ${Date.now()}`;
    await createAndOpenProject(projectName);

    // 2. Sanity: the app starts with zen mode off.
    const beforeZen = await readZenAttribute();
    expect(beforeZen).toBe("false");

    // 3. Open the command palette via the header "More" trigger.
    await safeClick("[data-testid='header-more']");
    const palette = await $("[data-testid='command-palette']");
    await browser.waitUntil(async () => await palette.isExisting(), {
      timeout: 10000,
      interval: 100,
    });

    // 4. Type "zen" to filter; the toggle-zen item is what we want to run.
    await safeSetValue("[data-testid='command-palette-input']", "zen");
    await browser.waitUntil(
      async () => await $("[data-testid='command-palette-item-toggle-zen']").isExisting(),
      { timeout: 10000, interval: 100 },
    );

    // 5. Click the toggle-zen entry. The palette should close and the
    //    .app-main element should pick up data-zen="true".
    await safeClick("[data-testid='command-palette-item-toggle-zen']");
    await browser.waitUntil(async () => (await readZenAttribute()) === "true", {
      timeout: 10000,
      interval: 100,
    });

    await browser.waitUntil(async () => !(await palette.isExisting()), {
      timeout: 10000,
      interval: 100,
    });

    // 6. Reset zen mode so the sidebar stays visible for subsequent tests.
    await safeClick("[data-testid='zen-toggle']");
    await browser.waitUntil(async () => (await readZenAttribute()) === "false", {
      timeout: 10000,
      interval: 100,
    });
  });
});
