import { describe, expect, it } from "vitest";
import { summarizeForPreview } from "./markdownPreview";

describe("summarizeForPreview", () => {
  it("returns empty string for nullish input", () => {
    expect(summarizeForPreview("")).toBe("");
    expect(summarizeForPreview(null)).toBe("");
    expect(summarizeForPreview(undefined)).toBe("");
  });

  it("passes plain prose through unchanged", () => {
    expect(summarizeForPreview("Hello world")).toBe("Hello world");
  });

  it("strips self-closing HTML tags", () => {
    expect(summarizeForPreview("line one<br/>line two")).toBe("line one line two");
  });

  it("keeps text inside an HTML anchor", () => {
    expect(summarizeForPreview('visit <a href="https://x">our site</a> today')).toBe(
      "visit our site today",
    );
  });

  it("pins the <3 (heart) quirk: regex requires a closing >, so <3 is left intact", () => {
    expect(summarizeForPreview("hello <3 world")).toBe("hello <3 world");
  });

  it("converts an open task list to ☐", () => {
    expect(summarizeForPreview("- [ ] buy milk")).toBe("☐ buy milk");
  });

  it("converts a checked task list to ☑", () => {
    expect(summarizeForPreview("- [x] ship it")).toBe("☑ ship it");
    expect(summarizeForPreview("- [X] ship it")).toBe("☑ ship it");
  });

  it("recognises * and + as alternate task list markers", () => {
    expect(summarizeForPreview("* [x] done")).toBe("☑ done");
    expect(summarizeForPreview("+ [ ] todo")).toBe("☐ todo");
  });

  it("converts backslash-escaped task list syntax", () => {
    expect(summarizeForPreview("\\[ ] escaped")).toBe("☐ escaped");
    expect(summarizeForPreview("\\[x] done")).toBe("☑ done");
  });

  it("joins multiple lines with the middot separator", () => {
    expect(summarizeForPreview("line one\n- line two\n- line three")).toBe(
      "line one  ·  line two  ·  line three",
    );
  });

  it("strips a leading heading marker", () => {
    expect(summarizeForPreview("## Subhead")).toBe("Subhead");
    expect(summarizeForPreview("# H1 title")).toBe("H1 title");
  });

  it("removes bold and italic emphasis", () => {
    expect(summarizeForPreview("**bold** and *italic*")).toBe("bold and italic");
  });

  it("handles a paragraph that starts with an emphasis star (regression for Bug A)", () => {
    // Leading-marker strip must run AFTER inline-emphasis strip, otherwise the
    // opening `*` is peeled and the pair can't match.
    expect(summarizeForPreview("*paragraph that starts with star*")).toBe(
      "paragraph that starts with star",
    );
  });

  it("removes inline code backticks", () => {
    expect(summarizeForPreview("run `npm test` first")).toBe("run npm test first");
  });

  it("drops fenced code blocks entirely (regression for Bug B)", () => {
    const input = "before\n```js\nconst x = 1;\n```\nafter";
    expect(summarizeForPreview(input)).toBe("before  ·  after");
  });

  it("reduces a link to its label", () => {
    expect(summarizeForPreview("see [docs](https://example.com)")).toBe("see docs");
  });

  it("reduces an image to its alt text", () => {
    expect(summarizeForPreview("![diagram](https://x.png) caption")).toBe("diagram caption");
  });

  it("truncates with an ellipsis when exceeding maxLength", () => {
    const long = "a".repeat(300);
    const out = summarizeForPreview(long, { maxLength: 280 });
    expect(out.length).toBe(280);
    expect(out.endsWith("…")).toBe(true);
  });
});
