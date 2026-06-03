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

  const fallback = await $("#fragment-editor textarea");
  if (await fallback.isExisting()) {
    await safeSetValue("#fragment-editor textarea", text);
    await blurActiveElement();
    return;
  }

  const proseMirror = await $("#fragment-editor .ProseMirror");
  await ensureInteractable(proseMirror);
  await safeClick("#fragment-editor .ProseMirror");
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
