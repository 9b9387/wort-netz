import { describe, expect, it } from "vitest";
import {
  buildEnglishDefinitions,
  primarySenseText,
  rankLexemeSenses,
  readLexemeSenses,
  type LexemeSense,
} from "../lib/word-senses";

function sense(overrides: Partial<LexemeSense> = {}): LexemeSense {
  return {
    text: "to want",
    partOfSpeech: "verb",
    tags: [],
    order: 0,
    entryOrder: 1,
    source: "wiktionary",
    ...overrides,
  };
}

describe("readLexemeSenses", () => {
  it("reads stored senses and normalizes their fields", () => {
    expect(
      readLexemeSenses([
        {
          text: "  to want ",
          partOfSpeech: "Verb",
          tags: ["Transitive", "  "],
          order: 0,
          entryOrder: 1,
          source: "wiktionary",
        },
      ]),
    ).toEqual([
      {
        text: "to want",
        partOfSpeech: "verb",
        tags: ["transitive"],
        order: 0,
        entryOrder: 1,
        source: "wiktionary",
      },
    ]);
  });

  it("ignores anything that is not a usable sense", () => {
    expect(readLexemeSenses(null)).toEqual([]);
    expect(readLexemeSenses([{ text: "   " }, { tags: [] }, "nope"])).toEqual(
      [],
    );
  });
});

describe("rankLexemeSenses", () => {
  // The real shape for the adjective entry of "wollen": the wool reading is the
  // only adjective sense, the verb senses follow in a second entry.
  const wollen = [
    sense({
      text: "(relational) wool; woolen, woollen",
      partOfSpeech: "adjective",
      tags: ["not comparable", "relational"],
      order: 0,
      entryOrder: 0,
    }),
    sense({
      text: "(transitive or intransitive) to want; to wish; to desire; to demand",
      partOfSpeech: "verb",
      tags: ["transitive"],
      order: 0,
      entryOrder: 1,
    }),
    sense({
      text: "(auxiliary) to want [with bare infinitive]",
      partOfSpeech: "verb",
      tags: ["auxiliary"],
      order: 3,
      entryOrder: 1,
    }),
  ];

  it("puts the reading of the word book entry first", () => {
    const ranked = rankLexemeSenses(wollen, "Verb");

    expect(ranked[0].text).toContain("to want");
    // The adjective reading is kept, just later.
    expect(ranked[2].text).toContain("wool");
  });

  it("keeps the dictionary order when the entry is the adjective", () => {
    const ranked = rankLexemeSenses(wollen, "Adjektiv");

    expect(ranked[0].text).toContain("wool");
    expect(ranked).toHaveLength(3);
  });

  it("demotes rare readings without dropping them", () => {
    const ranked = rankLexemeSenses(
      [
        sense({ text: "wool", tags: ["archaic"], order: 0, entryOrder: 0 }),
        sense({ text: "to want", tags: [], order: 0, entryOrder: 1 }),
      ],
      "Verb",
    );

    expect(ranked.map((item) => item.text)).toEqual(["to want", "wool"]);
  });

  it("stays stable on a full tie", () => {
    const equal = [
      sense({ text: "first" }),
      sense({ text: "second" }),
    ];

    expect(rankLexemeSenses(equal, null).map((item) => item.text)).toEqual([
      "first",
      "second",
    ]);
  });
});

describe("primarySenseText", () => {
  it("returns the top ranked sense", () => {
    expect(
      primarySenseText(
        [
          sense({
            text: "wool",
            partOfSpeech: "adjective",
            entryOrder: 0,
          }),
          sense({ text: "to want", partOfSpeech: "verb", entryOrder: 1 }),
        ],
        "Verb",
      ),
    ).toBe("to want");
  });

  it("falls back to the legacy definition for old rows", () => {
    expect(primarySenseText([], "Verb", "lamp, light\nbulb")).toBe("lamp, light");
    expect(primarySenseText([], null, null)).toBeNull();
  });
});

describe("buildEnglishDefinitions", () => {
  it("ranks dictionary senses without dropping any", () => {
    const items = buildEnglishDefinitions({
      senses: [
        sense({
          text: "wool; woolen",
          partOfSpeech: "adjective",
          tags: ["relational"],
          entryOrder: 0,
        }),
        sense({ text: "to want", partOfSpeech: "verb", entryOrder: 1 }),
      ],
      wordType: "Verb",
    });

    expect(items.map((item) => item.text)).toEqual(["to want", "wool; woolen"]);
    expect(items[0].partOfSpeech).toBe("verb");
    expect(items[1].rare).toBe(true);
  });

  it("de-duplicates and respects the limit", () => {
    const items = buildEnglishDefinitions({
      senses: [sense({ text: "to want" }), sense({ text: "To Want" })],
      wordType: "Verb",
      limit: 1,
    });

    expect(items).toHaveLength(1);
    expect(items[0].text).toBe("to want");
  });

  it("falls back to the stored definition when no senses exist yet", () => {
    const items = buildEnglishDefinitions({
      senses: [],
      wordType: "Substantiv",
      definitionEn: "lamp, light\nbulb, light bulb",
    });

    expect(items.map((item) => item.text)).toEqual([
      "lamp, light",
      "bulb, light bulb",
    ]);
  });
});
