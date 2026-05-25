import { browser } from "@wdio/globals";
import { ensureInteractable, safeClick, safeSetValue } from "./ui";

export async function setFragmentEditorContent(text: string) {
  const editor = await $("#fragment-editor");
  await editor.waitForExist({ timeout: 20000 });

  const tag = await editor.getTagName();
  if (tag.toLowerCase() === "textarea") {
    await safeSetValue("#fragment-editor", text);
    await browser.execute(() => {
      (document.activeElement as HTMLElement | null)?.blur?.();
    });
    return;
  }

  const cmContent = await $(".cm-content");
  await ensureInteractable(cmContent);
  await safeClick(".cm-content");
  await browser.keys(["Control", "a"]);
  await browser.keys("Backspace");
  for (const ch of text) {
    if (ch === "\n") {
      await browser.keys("Enter");
    } else {
      await browser.keys(ch);
    }
  }
  await browser.execute(() => {
    (document.activeElement as HTMLElement | null)?.blur?.();
  });
}
