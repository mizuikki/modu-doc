import { browser } from "@wdio/globals";

function isWindowsAttachMode() {
  if (process.platform !== "win32") return false;
  const strategy = (process.env.MODUDOC_E2E_WINDOWS_STRATEGY ?? "").trim().toLowerCase();
  if (strategy === "attach") return true;
  return Boolean(
    process.env.MODUDOC_E2E_EDGE_DRIVER_PORT && process.env.MODUDOC_E2E_WEBVIEW_DEBUG_PORT,
  );
}

export async function dismissWorkspaceStatus() {
  // The popover can re-render in response to fresh status events fired by the
  // test's own actions (e.g. autosave, recipe updates), so a single close click
  // is not enough. Drain it by clicking close in a loop until the message has
  // stayed cleared for one full check cycle or we hit the timeout.
  await browser.waitUntil(
    async () => {
      const popover = await $("[data-testid='workspace-status-popover']");
      if (!(await popover.isExisting())) {
        return true;
      }
      const close = await $("[data-testid='workspace-status-close']");
      if (await close.isExisting()) {
        try {
          await close.click();
        } catch {
          await browser.execute(() => {
            (
              document.querySelector("[data-testid='workspace-status-close']") as HTMLElement | null
            )?.click();
          });
        }
      }
      return false;
    },
    { timeout: 10000, interval: 100 },
  );
}

export async function ensureInteractable(element: WebdriverIO.Element, timeoutMs = 20000) {
  await element.waitForExist({ timeout: timeoutMs });
  await element.waitForDisplayed({ timeout: timeoutMs });
  try {
    await element.scrollIntoView({ block: "center", inline: "center" });
  } catch {
    // WebDriver's scrollIntoView can fail with "move target out of bounds" on
    // nested scroll containers. Fall back to a JS-driven scroll on the
    // nearest scrollable ancestor so the element is brought into view.
    await browser.execute((target) => {
      const elementNode = target as HTMLElement | null;
      if (!elementNode) return;
      const rect = elementNode.getBoundingClientRect();
      if (rect.top >= 0 && rect.bottom <= window.innerHeight) return;
      let parent: HTMLElement | null = elementNode.parentElement;
      while (parent && parent !== document.body) {
        const overflowY = window.getComputedStyle(parent).overflowY;
        if (overflowY === "auto" || overflowY === "scroll") {
          const parentRect = parent.getBoundingClientRect();
          const offset = rect.top - parentRect.top;
          parent.scrollTop += offset - parent.clientHeight / 2;
          return;
        }
        parent = parent.parentElement;
      }
      elementNode.scrollIntoView({ block: "center", inline: "center" });
    }, element);
  }
  await element.waitForEnabled({ timeout: timeoutMs });
}

export async function safeClick(selector: string, timeoutMs = 20000) {
  const element = await $(selector);
  await ensureInteractable(element, timeoutMs);
  const windowsAttach = isWindowsAttachMode();

  if (!windowsAttach) {
    try {
      await element.click();
      return;
    } catch {
      // fall through to JS click
    }
  }

  await browser.execute((target) => {
    const elementNode = target as HTMLElement | null;
    elementNode?.click?.();
  }, element);
}

export async function safeSetValue(selector: string, value: string, timeoutMs = 20000) {
  const element = await $(selector);
  await ensureInteractable(element, timeoutMs);
  const windowsAttach = isWindowsAttachMode();

  try {
    if (!windowsAttach) {
      await element.click();
    } else {
      await browser.execute((cssSelector) => {
        const input = document.querySelector(cssSelector) as HTMLElement | null;
        input?.focus?.();
      }, selector);
    }

    try {
      await element.clearValue();
    } catch {
      // ignore
    }

    await element.setValue(value);
    return;
  } catch {
    await browser.execute(
      (cssSelector, nextValue) => {
        const input = document.querySelector(cssSelector) as
          | HTMLInputElement
          | HTMLTextAreaElement
          | null;
        if (!input) return;
        input.focus();
        input.value = String(nextValue);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        input.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }));
        input.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: "Enter" }));
      },
      selector,
      value,
    );
  }
}

export async function selectWorkspaceById(workspaceId: string, timeoutMs = 20000) {
  await dismissWorkspaceStatus();
  await safeClick("[data-testid='workspace-select-trigger']", timeoutMs);
  await safeClick(`[data-testid='workspace-select-item-${workspaceId}']`, timeoutMs);
  await browser.waitUntil(
    async () => {
      const trigger = await $("[data-testid='workspace-select-trigger']");
      const current = await trigger.getAttribute("data-current-workspace-id");
      return current === workspaceId;
    },
    { timeout: timeoutMs, interval: 200 },
  );
}

export async function openSidebarMore(timeoutMs = 20000) {
  const trigger = await $("[data-testid='sidebar-more-trigger']");
  await ensureInteractable(trigger, timeoutMs);
  await safeClick("[data-testid='sidebar-more-trigger']", timeoutMs);
  const content = await $("[data-testid='sidebar-more-content']");
  await browser.waitUntil(async () => await content.isExisting(), {
    timeout: timeoutMs,
    interval: 100,
  });
}

export async function openAddFragmentMenu(timeoutMs = 20000) {
  const trigger = await $("[data-testid='recipe-add-fragment-menu']");
  await ensureInteractable(trigger, timeoutMs);
  await safeClick("[data-testid='recipe-add-fragment-menu']", timeoutMs);
  const content = await $("[data-testid='recipe-add-fragment-menu-content']");
  await browser.waitUntil(async () => await content.isExisting(), {
    timeout: timeoutMs,
    interval: 100,
  });
}

export async function openLibraryDialog(mode: "insert" | "manage" = "insert", timeoutMs = 20000) {
  const trigger = (await $("[data-testid='recipe-add-fragment']").isExisting())
    ? "[data-testid='recipe-add-fragment']"
    : "[data-testid='recipe-empty-add-fragment']";
  await safeClick(trigger, timeoutMs);
  const dialog = await $("[data-testid='fragment-library-dialog']");
  await browser.waitUntil(async () => await dialog.isExisting(), {
    timeout: timeoutMs,
    interval: 100,
  });
  if (mode === "manage") {
    await safeClick("[data-testid='fragment-library-mode-manage']", timeoutMs);
  } else {
    await safeClick("[data-testid='fragment-library-mode-insert']", timeoutMs);
  }
}

export async function openCommandPalette(timeoutMs = 20000) {
  const trigger = await $("[data-testid='header-more']");
  await ensureInteractable(trigger, timeoutMs);
  await safeClick("[data-testid='header-more']", timeoutMs);
  const input = await $("[data-testid='command-palette-input']");
  await browser.waitUntil(async () => await input.isExisting(), {
    timeout: timeoutMs,
    interval: 100,
  });
}

export async function runCommandPaletteCommand(labelSubstring: string, timeoutMs = 20000) {
  await openCommandPalette(timeoutMs);
  await safeSetValue("[data-testid='command-palette-input']", labelSubstring, timeoutMs);
  await browser.keys("Enter");
  await browser.waitUntil(
    async () => !(await $("[data-testid='command-palette-input']").isExisting()),
    { timeout: timeoutMs, interval: 100 },
  );
}

export async function createWorkspaceViaUI(name: string, timeoutMs = 20000) {
  await openSidebarMore(timeoutMs);
  await safeClick("[data-testid='sidebar-new-workspace']", timeoutMs);
  await safeSetValue("[data-testid='app-prompt-input']", name, timeoutMs);
  await safeClick("[data-testid='app-dialog-confirm']", timeoutMs);
}

export async function createFragmentViaUI(name: string, timeoutMs = 20000) {
  await openAddFragmentMenu(timeoutMs);
  await safeClick("[data-testid='fragments-new']", timeoutMs);
  await safeSetValue("[data-testid='app-prompt-input']", name, timeoutMs);
  await safeClick("[data-testid='app-dialog-confirm']", timeoutMs);
}
