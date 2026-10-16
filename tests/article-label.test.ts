import { describe, expect, it } from "vitest";
import {
  ARTICLE_EMPTY_LABEL,
  countArticleChars,
  deriveArticleExcerpt,
  summarizeArticle,
} from "../lib/reader/article-label";

describe("deriveArticleExcerpt", () => {
  it("uses the first non-empty line and collapses whitespace", () => {
    expect(
      deriveArticleExcerpt("\n\n  Der   Hund   läuft  \n zweite Zeile"),
    ).toBe("Der Hund läuft");
  });

  it("truncates long first lines with an ellipsis", () => {
    const long = "a".repeat(60);
    const excerpt = deriveArticleExcerpt(long);

    expect(excerpt).toHaveLength(41);
    expect(excerpt.endsWith("…")).toBe(true);
  });

  it("falls back to a placeholder for empty content", () => {
    expect(deriveArticleExcerpt("   \n  ")).toBe(ARTICLE_EMPTY_LABEL);
    expect(deriveArticleExcerpt("")).toBe(ARTICLE_EMPTY_LABEL);
  });
});

describe("countArticleChars", () => {
  it("ignores surrounding whitespace", () => {
    expect(countArticleChars("  Hallo Welt  ")).toBe(10);
    expect(countArticleChars("\n\n")).toBe(0);
  });
});

describe("summarizeArticle", () => {
  it("returns both derived fields", () => {
    expect(summarizeArticle("Hallo Welt")).toEqual({
      excerpt: "Hallo Welt",
      charCount: 10,
    });
  });
});
