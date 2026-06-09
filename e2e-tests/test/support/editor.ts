import { browser } from "@wdio/globals";
import { ensureInteractable, safeClick, safeSetValue } from "./ui";

/**
 * Old helper retained for any spec that still drives the right-panel
 * FragmentEditor (the Milkdown editor there is unchanged). New specs that
 * drive the main DocumentEditor should use the textarea helpers below.
 */
export async function waitForFragmentEditorReady(timeoutMs = 20000) {
  const editor = await $("#fragment-editor");
  await editor.waitForExist({ timeout: timeoutMs });
  await browser.waitUntil(
    async () => {
      const fallback = await $("#fragment-editor textarea");
      if (await fallback.isExisting()) return true;
      const proseMirror = await $("#fragment-editor .ProseMirror");
      return await proseMirror.isExisting();
    },
    { timeout: timeoutMs, interval: 100, timeoutMsg: "fragment editor not ready" },
  );
}

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
      if (!(await label.isExisting())) return false;
      return (await label.getText()).includes(fragmentName);
    },
    {
      timeout: timeoutMs,
      interval: 200,
      timeoutMsg: `fragment label not ready: ${fragmentName}`,
    },
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

/**
 * Drive the new document editor textarea:
 *   1. Ensure the center mode is "edit".
 *   2. Set the textarea value via a controlled input event so React's
 *      onChange fires.
 *   3. Blur to trigger the store flush (which calls update_document).
 */
export async function setDocumentEditorContent(text: string, timeoutMs = 20000) {
  const editorMode = await $("[data-testid='document-header-mode-edit']");
  if (await editorMode.isExisting()) {
    await safeClick("[data-testid='document-header-mode-edit']", timeoutMs);
  }
  const textarea = await $("[data-testid='editor-pane-textarea']");
  await textarea.waitForExist({ timeout: timeoutMs });
  await ensureInteractable(textarea, timeoutMs);
  await safeSetValue("[data-testid='editor-pane-textarea']", text, timeoutMs);
  await blurActiveElement();
}

export async function typeInDocumentEditor(text: string, timeoutMs = 20000) {
  const textarea = await $("[data-testid='editor-pane-textarea']");
  await textarea.waitForExist({ timeout: timeoutMs });
  await ensureInteractable(textarea, timeoutMs);
  await textarea.click();
  for (const ch of text) {
    if (ch === "\n") {
      await browser.keys("Enter");
    } else {
      await browser.keys(ch);
    }
  }
  await blurActiveElement();
}
