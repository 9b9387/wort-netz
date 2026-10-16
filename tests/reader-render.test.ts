import { describe, expect, it } from "vitest";
import {
  domOffsetToSourceOffset,
  segmentBlock,
  splitTextBlocks,
} from "../lib/reader/render-blocks";
import { buildSpeechChunks } from "../lib/reader/speech-chunks";
import { tokenizeWords } from "../lib/reader/tokenize";
import type { ReaderToken } from "../lib/reader/types";
import {
  buildWordEntries,
  countUnrecognizedEntries,
  selectStudyEntries,
} from "../lib/reader/word-list";

function token(overrides: Partial<ReaderToken>): ReaderToken {
  return {
    text: "Wort",
    start: 0,
    end: 4,
    category: "unlearned",
    lemma: "Wort",
    lexemeId: null,
    match: "exact",
    pos: null,
    level: null,
    isFunctionWord: false,
    inWordBook: false,
    isFavorite: false,
    dueAt: null,
    ...overrides,
  };
}

describe("splitTextBlocks", () => {
  it("keeps blank lines as empty blocks", () => {
    expect(splitTextBlocks("a\n\nb")).toEqual([
      { start: 0, end: 1, text: "a" },
      { start: 2, end: 2, text: "" },
      { start: 3, end: 4, text: "b" },
    ]);
  });
});

describe("segmentBlock", () => {
  it("re-emits the original text with tokens nested inside", () => {
    const text = "Der Hund läuft.\nDie Katze auch.";
    const tokens = tokenizeWords(text).map((raw) =>
      token({ text: raw.text, start: raw.start, end: raw.end }),
    );
    const blocks = splitTextBlocks(text);
    let cursor = 0;

    const rebuilt = blocks
      .map((block) => {
        const { segments, nextIndex } = segmentBlock(
          text,
          block,
          tokens,
          cursor,
        );
        cursor = nextIndex;

        return segments
          .map((segment) =>
            segment.kind === "text" ? segment.value : segment.token.text,
          )
          .join("");
      })
      .join("\n");

    expect(rebuilt).toBe(text);
  });
});

describe("domOffsetToSourceOffset", () => {
  const text = "Der Hund läuft.\n\nDie Katze auch.";
  const blocks = splitTextBlocks(text);
  // What the DOM contains: the block texts without the newlines between them.
  const domText = blocks.map((block) => block.text).join("");

  it("maps every DOM offset back to the matching source character", () => {
    // Regression: the newlines dropped from the DOM used to shift every offset
    // after the first line, so the spoken selection started too early.
    for (let domOffset = 0; domOffset < domText.length; domOffset += 1) {
      const sourceOffset = domOffsetToSourceOffset(blocks, domOffset);

      expect(text[sourceOffset]).toBe(domText[domOffset]);
    }
  });

  it("skips the blank line that the DOM cannot represent", () => {
    const lineTwoStart = domText.indexOf("Die Katze");

    expect(
      domOffsetToSourceOffset(blocks, lineTwoStart),
    ).toBe(text.indexOf("Die Katze"));
  });

  it("clamps to the end of the text", () => {
    expect(domOffsetToSourceOffset(blocks, domText.length)).toBe(text.length);
    expect(domOffsetToSourceOffset(blocks, 9_999)).toBe(text.length);
    expect(domOffsetToSourceOffset([], 4)).toBe(4);
  });
});

describe("buildWordEntries", () => {
  it("aggregates repeated words and sorts unlearned first", () => {
    const entries = buildWordEntries([
      token({ text: "Haus", lemma: "Haus", start: 0 }),
      token({ text: "Haus", lemma: "Haus", start: 10 }),
      token({
        text: "der",
        lemma: "der",
        category: "learned",
        inWordBook: true,
        lexemeId: "44444444-4444-4444-4444-444444444444",
        start: 20,
      }),
      token({
        text: "herum",
        lemma: null,
        category: "unrecognized",
        start: 30,
      }),
    ]);

    expect(entries.map((entry) => entry.lemma)).toEqual([
      "Haus",
      "herum",
      "der",
    ]);
    expect(entries[0]?.count).toBe(2);
    expect(entries[0]?.surface).toBe("Haus");
  });

});

describe("selectStudyEntries", () => {
  const entries = buildWordEntries([
    token({ text: "Haus", lemma: "Haus", start: 0 }),
    token({
      text: "herum",
      lemma: null,
      category: "unrecognized",
      start: 10,
    }),
    token({
      text: "der",
      lemma: "der",
      category: "learned",
      inWordBook: true,
      start: 20,
    }),
  ]);

  it("keeps unlearned and learned words but drops unrecognized ones", () => {
    expect(selectStudyEntries(entries).map((entry) => entry.lemma)).toEqual([
      "Haus",
      "der",
    ]);
  });

  it("counts what was left out so the panel can say so", () => {
    expect(countUnrecognizedEntries(entries)).toBe(1);
  });

});

describe("buildSpeechChunks", () => {
  it("returns one chunk for a short text", () => {
    const text = "Der Hund läuft.";
    const chunks = buildSpeechChunks(text);

    expect(chunks).toHaveLength(1);
    expect(text.slice(chunks[0].start, chunks[0].end)).toBe(text);
  });

  it("splits long texts and keeps absolute offsets", () => {
    const text = `${"Ein sehr langer Satz mit vielen Wörtern. ".repeat(8)}Ende.`;
    const chunks = buildSpeechChunks(text);

    expect(chunks.length).toBeGreaterThan(1);

    for (const chunk of chunks) {
      const slice = text.slice(chunk.start, chunk.end);

      expect(slice.length).toBeGreaterThan(0);
      expect(slice.trim()).toBe(slice.trim());
      expect(text.includes(slice)).toBe(true);
    }
  });

  it("honours an explicit range", () => {
    const text = "Erster Satz. Zweiter Satz.";
    const chunks = buildSpeechChunks(text, { start: 13, end: text.length });

    expect(chunks).toHaveLength(1);
    expect(text.slice(chunks[0].start, chunks[0].end).trim()).toBe(
      "Zweiter Satz.",
    );
  });

  it("returns nothing for an empty range", () => {
    expect(buildSpeechChunks("Hallo", { start: 2, end: 2 })).toEqual([]);
  });
});
