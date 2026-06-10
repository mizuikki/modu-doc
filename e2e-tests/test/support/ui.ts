import { browser } from "@wdio/globals";

function isWindowsAttachMode() {
  if (process.platform !== "win32") return false;
  const strategy = (process.env.MODUDOC_E2E_WINDOWS_STRATEGY ?? "").trim().toLowerCase();
  if (strategy === "attach") return true;
  return Boolean(
    process.env.MODUDOC_E2E_EDGE_DRIVER_PORT && process.env.MODUDOC_E2E_WEBVIEW_DEBUG_PORT,
  );
}

export async function dismissDocumentStatus() {
  await browser.waitUntil(
    async () => {
      const popover = await $("[data-testid='project-status-popover']");
      if (!(await popover.isExisting())) {
        return true;
      }
      const close = await $("[data-testid='project-status-close']");
      if (await close.isExisting()) {
        try {
          await close.click();
        } catch {
          await browser.execute(() => {
            (
              document.querySelector("[data-testid='project-status-close']") as HTMLElement | null
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

export async function openSidebarMore(timeoutMs = 20000) {
  const trigger = await $("[data-testid='sidebar-project-switcher']");
  await ensureInteractable(trigger, timeoutMs);
  await safeClick("[data-testid='sidebar-project-switcher']", timeoutMs);
  const content = await $("[data-testid='sidebar-project-menu']");
  await browser.waitUntil(async () => await content.isExisting(), {
    timeout: timeoutMs,
    interval: 100,
  });
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

export async function selectDocumentInSidebar(documentId: string, timeoutMs = 20000) {
  await safeClick(`[data-testid='sidebar-document-${documentId}']`, timeoutMs);
  await browser.waitUntil(
    async () => {
      const trigger = await $(`[data-testid='sidebar-document-${documentId}']`);
      return (await trigger.getAttribute("data-active")) === "true";
    },
    { timeout: timeoutMs, interval: 200 },
  );
}

export async function clickCenterMode(
  mode: "edit" | "split" | "preview" | "history",
  timeoutMs = 20000,
) {
  await safeClick(`[data-testid='document-header-mode-${mode}']`, timeoutMs);
}

export async function clickTargetBarWrite(timeoutMs = 20000) {
  await safeClick("[data-testid='target-bar-write']", timeoutMs);
}

export async function clickConflictPolicy(
  policy: "import_external" | "overwrite_external" | "backup_and_overwrite" | "cancel",
  timeoutMs = 20000,
) {
  await safeClick(`[data-testid='target-bar-resolve-${policy}']`, timeoutMs);
}

export async function waitForTargetBarConflict(timeoutMs = 20000) {
  const bar = await $("[data-testid='target-bar-conflict']");
  await browser.waitUntil(async () => await bar.isExisting(), {
    timeout: timeoutMs,
    interval: 200,
  });
}

export async function assertDocumentSaveState(
  documentId: string,
  expected: "draft" | "unsaved" | "saved" | "conflict" | "error" | (string & {}),
  timeoutMs = 20000,
) {
  await browser.waitUntil(
    async () => {
      const row = await $(`[data-testid='sidebar-document-${documentId}']`);
      if (await row.isExisting()) {
        const saveState = await row.getAttribute("data-save-state");
        if (saveState) {
          return saveState.toLowerCase() === expected.toLowerCase();
        }
      }

      const status = await $(`[data-testid='sidebar-document-status-${documentId}']`);
      if (!(await status.isExisting())) return false;
      const text = (await status.getText()).trim().toLowerCase();
      return text === expected.toLowerCase();
    },
    {
      timeout: timeoutMs,
      interval: 200,
      timeoutMsg: `expected document ${documentId} save_state=${expected}`,
    },
  );
}
