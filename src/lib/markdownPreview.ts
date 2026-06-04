const DEFAULT_MAX_LENGTH = 280;
const SEPARATOR = "  ·  ";

/**
 * Reduce a raw markdown fragment into a single-line preview string suitable for a
 * compact card. Strips HTML and markdown noise, normalises GFM task lists to
 * Unicode checkboxes, and joins surviving lines with a middot separator.
 *
 * Pure function. Returns "" for null/empty input — the caller decides the
 * i18n fallback (e.g. `t("empty_fragment")`).
 */
export function summarizeForPreview(
  input: string | null | undefined,
  opts?: { maxLength?: number },
): string {
  if (!input) return "";

  let text = input;

  // 1. Strip HTML tags. Note: also mangles <3 (heart) → "3". Pinned by test.
  text = text.replace(/<[^>]*>/g, " ");

  // 2. Drop fenced code blocks entirely. Must run BEFORE inline-code strip
  //    so the backticks inside ```…``` are not partially matched.
  text = text.replace(/```[\s\S]*?```/g, "");

  // 3. GFM task lists → Unicode checkboxes. Cover all three list markers
  //    (-, *, +) and the backslash-escaped variant users occasionally paste.
  text = text.replace(/^\s*[-*+]\s+\[[xX]\]/gm, "☑");
  text = text.replace(/^\s*[-*+]\s+\[\s\]/gm, "☐");
  text = text.replace(/\\\[\s*[xX]\s*\]/g, "☑");
  text = text.replace(/\\\[\s*\]/g, "☐");

  // 4. Inline emphasis / code. Must run BEFORE leading-marker strip,
  //    otherwise leading `*` is peeled off and the pair can't match.
  text = text.replace(/\*\*([^*]+)\*\*/g, "$1");
  text = text.replace(/\*([^*\n]+)\*/g, "$1");
  text = text.replace(/`([^`\n]+)`/g, "$1");

  // 5. Images → alt text. Run before links so `![…](…)` matches this, not links.
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");

  // 6. Links → label.
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");

  // 7. Leading line markers (blockquote, heading, list, HR). `_` is intentionally
  //    excluded to avoid mangling `var_name` / `don't` in mixed prose.
  text = text.replace(/^[\s>*+\-#]+/gm, "");

  // 8. Flatten to one line. Collapse internal whitespace per line so the
  //    separator's double-spaces survive the join.
  const lines = text
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0);
  text = lines.join(SEPARATOR);

  const cap = opts?.maxLength ?? DEFAULT_MAX_LENGTH;
  if (cap > 0 && text.length > cap) {
    text = `${text.slice(0, Math.max(0, cap - 1)).trimEnd()}…`;
  }

  return text;
}
