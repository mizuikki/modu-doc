import { browser } from "@wdio/globals";
import { ensureInteractable, safeClick, safeSetValue } from "./ui";

export async function waitForFragmentEditorReady(timeoutMs = 20000) {
  const editor = await $("#fragment-editor");
  await editor.waitForExist({ timeout: timeoutMs });

  await browser.waitUntil(
    async () => {
      const fallback = await $("#fragment-editor textarea");
      if (await fallback.isExisting()) {
        return true;
      }
      const proseMirror = await $("#fragment-editor .ProseMirror");
      return await proseMirror.isExisting();
    },
    { timeout: timeoutMs, interval: 100, timeoutMsg: "fragment editor not ready" },
  );
}

// Wait for the Milkdown editor to be in a fully-bound, post-replace state for
// the current document. The editor exposes a `data-editor-status` attribute
// ("loading" | "ready" | "failed"); typing before status is "ready" causes
// characters to land in the wrong document.
export async function waitForFragmentEditorStatus(
  expected: "ready" | "failed" = "ready",
  timeoutMs = 20000,
) {
  const editor = await $("#fragment-editor");
  await editor.waitForExist({ timeout: timeoutMs });
  await browser.waitUntil(
    async () => (await editor.getAttribute("data-editor-status")) === expected,
    { timeout: timeoutMs, interval: 100, timeoutMsg: `editor not ${expected}` },
  );
}

export async function focusFragmentEditor() {
  await waitForFragmentEditorReady();
  const fallback = await $("#fragment-editor textarea");
  if (await fallback.isExisting()) {
    await fallback.click();
    return;
  }
  const proseMirror = await $("#fragment-editor .ProseMirror");
  await ensureInteractable(proseMirror);
  await safeClick("#fragment-editor .ProseMirror");
}

export async function blurActiveElement() {
  await browser.execute(() => {
    (document.activeElement as HTMLElement | null)?.blur?.();
  });
}

export async function waitForFragmentLabel(fragmentName: string, timeoutMs = 20000) {
  await browser.waitUntil(
    async () => {
      const label = await $("label[for='fragment-editor']");
      if (!(await label.isExisting())) {
        return false;
      }
      return (await label.getText()).includes(fragmentName);
    },
    { timeout: timeoutMs, interval: 200, timeoutMsg: `fragment label not ready: ${fragmentName}` },
  );
}

export async function typeInFragmentEditor(text: string) {
  await focusFragmentEditor();
  for (const ch of text) {
    if (ch === "\n") {
      await browser.keys("Enter");
    } else {
      await browser.keys(ch);
    }
  }
}

export async function setFragmentEditorContent(text: string) {
  await waitForFragmentEditorReady();
  await waitForFragmentEditorStatus("ready");

  const fallback = await $("#fragment-editor textarea");
  if (await fallback.isExisting()) {
    await safeSetValue("#fragment-editor textarea", text);
    await blurActiveElement();
    return;
  }

  const proseMirror = await $("#fragment-editor .ProseMirror");
  await ensureInteractable(proseMirror);
  // Focus the contenteditable so subsequent key events route to ProseMirror.
  await browser.execute(() => {
    const host = document.querySelector(
      "[data-testid='fragment-editor'] .ProseMirror",
    ) as HTMLElement | null;
    host?.focus();
  });

  await browser.keys(["Control", "a"]);
  await browser.keys("Backspace");
  for (const ch of text) {
    if (ch === "\n") {
      await browser.keys("Enter");
    } else {
      await browser.keys(ch);
    }
  }
  await blurActiveElement();
}
