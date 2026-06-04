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
  const popover = await $("[data-testid='workspace-status-popover']");
  if (!(await popover.isExisting())) return;

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

  await browser.waitUntil(async () => !(await popover.isExisting()), {
    timeout: 5000,
    interval: 100,
  });
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
