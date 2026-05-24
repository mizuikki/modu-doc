import { browser } from "@wdio/globals";
import { ensureInteractable } from "./ui";

export async function setFragmentEditorContent(text: string) {
  const editor = await $("#fragment-editor");
  await editor.waitForExist({ timeout: 20000 });

  const tag = await editor.getTagName();
  if (tag.toLowerCase() === "textarea") {
    await ensureInteractable(editor);
    await editor.click();
    try {
      await editor.clearValue();
    } catch {
      // ignore
    }
    await editor.setValue(text);
    await browser.execute(() => {
      (document.activeElement as HTMLElement | null)?.blur?.();
    });
    return;
  }

  const cmContent = await $(".cm-content");
  await ensureInteractable(cmContent);
  await cmContent.click();
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
