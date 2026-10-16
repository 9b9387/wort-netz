import { describe, expect, it } from "vitest";
import {
  deriveReaderPaneView,
  opensDetailPane,
  readerHref,
} from "../lib/reader/pane-state";

describe("deriveReaderPaneView", () => {
  it("opens the word pane when a word is selected", () => {
    expect(deriveReaderPaneView({ w: "abc" })).toBe("word");
  });

  it("opens the word list pane for pane=words", () => {
    expect(deriveReaderPaneView({ pane: "words" })).toBe("words");
  });

  it("falls back to the list layout", () => {
    expect(deriveReaderPaneView({})).toBe("list");
    expect(deriveReaderPaneView({ article: "abc" })).toBe("list");
    expect(deriveReaderPaneView({ pane: "other" })).toBe("list");
  });
});

describe("opensDetailPane", () => {
  it("only word selection and the word list switch the layout", () => {
    expect(opensDetailPane({ kind: "select-word", lexemeId: "x" })).toBe(true);
    expect(opensDetailPane({ kind: "open-word-list" })).toBe(true);
    expect(opensDetailPane({ kind: "select-article", articleId: "x" })).toBe(
      false,
    );
    expect(opensDetailPane({ kind: "back-to-list" })).toBe(false);
    expect(opensDetailPane({ kind: "close-detail" })).toBe(false);
    expect(opensDetailPane({ kind: "new-draft" })).toBe(false);
    expect(opensDetailPane({ kind: "clear-article" })).toBe(false);
  });
});

describe("readerHref", () => {
  it("keeps the article while opening a word", () => {
    expect(
      readerHref(
        { article: "a1", w: "w1" },
        { kind: "select-word", lexemeId: "w2" },
      ),
    ).toBe("/reader?article=a1&w=w2");
  });

  it("carries the clicked form so the card can show it instead of the lemma", () => {
    expect(
      readerHref(
        { article: "a1" },
        { kind: "select-word", lexemeId: "w2", surface: "willst" },
      ),
    ).toBe("/reader?article=a1&w=w2&s=willst");
  });

  it("drops the clicked form when leaving the detail pane", () => {
    expect(
      readerHref(
        { article: "a1", w: "w1" },
        { kind: "open-word-list" },
      ),
    ).toBe("/reader?article=a1&pane=words");
    expect(
      readerHref({ article: "a1", w: "w1" }, { kind: "back-to-list" }),
    ).toBe("/reader?article=a1");
  });

  it("drops the word when returning to the article list", () => {
    expect(
      readerHref(
        { article: "a1", w: "w1" },
        { kind: "back-to-list" },
      ),
    ).toBe("/reader?article=a1");
  });

  it("switches to another article and clears the detail pane", () => {
    expect(
      readerHref(
        { article: "a1", w: "w1" },
        { kind: "select-article", articleId: "a2" },
      ),
    ).toBe("/reader?article=a2");
  });

  it("opens the word list for the current article", () => {
    expect(
      readerHref({ article: "a1" }, { kind: "open-word-list" }),
    ).toBe("/reader?article=a1&pane=words");
  });

  it("supports a fresh draft and a fully cleared selection", () => {
    expect(readerHref({ article: "a1" }, { kind: "new-draft" })).toBe(
      "/reader?draft=1",
    );
    expect(readerHref({ article: "a1" }, { kind: "clear-article" })).toBe(
      "/reader",
    );
  });
});
