import { browser } from "@wdio/globals";

export async function dismissWorkspaceStatus() {
  const popover = await $("[data-testid='workspace-status-popover']");
  if (!(await popover.isExisting())) return;

  const close = await $("[data-testid='workspace-status-close']");
  if (await close.isExisting()) {
    await close.click();
  }

  await browser.waitUntil(async () => !(await popover.isExisting()), {
    timeout: 5000,
    interval: 100,
  });
}

export async function ensureInteractable(element: WebdriverIO.Element, timeoutMs = 20000) {
  await element.waitForExist({ timeout: timeoutMs });
  await element.waitForDisplayed({ timeout: timeoutMs });
  await element.scrollIntoView();
  await element.waitForEnabled({ timeout: timeoutMs });
}

export async function safeClick(selector: string, timeoutMs = 20000) {
  const element = await $(selector);
  await ensureInteractable(element, timeoutMs);
  if (!(await element.isClickable())) {
    await browser.waitUntil(async () => await element.isClickable(), {
      timeout: timeoutMs,
      interval: 200,
    });
  }
  try {
    await element.click();
  } catch {
    await browser.execute((cssSelector) => {
      (document.querySelector(cssSelector) as HTMLElement | null)?.click();
    }, selector);
  }
}

export async function safeSetValue(selector: string, value: string, timeoutMs = 20000) {
  const element = await $(selector);
  await ensureInteractable(element, timeoutMs);
  try {
    await element.click();
    try {
      await element.clearValue();
    } catch {
      // ignore
    }
    await element.setValue(value);
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
      },
      selector,
      value,
    );
  }
}

export async function selectWorkspaceById(workspaceId: string, timeoutMs = 20000) {
  await dismissWorkspaceStatus();
  const select = await $("#workspace-select");
  await ensureInteractable(select, timeoutMs);
  await select.selectByAttribute("value", workspaceId);
  await browser.waitUntil(async () => (await select.getValue()) === workspaceId, {
    timeout: timeoutMs,
    interval: 200,
  });
}
