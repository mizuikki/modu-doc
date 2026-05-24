import type { TFunction } from "i18next";
import i18next from "i18next";

const exists: typeof i18next.exists = i18next.exists;

export function tMaybe(t: TFunction, keyOrText: string): string {
  if (exists(keyOrText)) {
    return t(keyOrText as never);
  }
  return keyOrText;
}
