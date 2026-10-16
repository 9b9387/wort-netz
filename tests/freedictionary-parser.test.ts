import { describe, expect, it } from "vitest";
import { parseFreeDictionaryResponse } from "../lib/server/freedictionary-parser";

describe("parseFreeDictionaryResponse", () => {
  it("extracts German English definitions and noun forms", () => {
    const result = parseFreeDictionaryResponse(
      {
        word: "Lampe",
        source: {
          url: "https://en.wiktionary.org/wiki/Lampe",
          license: { name: "CC BY-SA 4.0" },
        },
        entries: [
          {
            language: { code: "de", name: "German" },
            partOfSpeech: "noun",
            senses: [
              {
                definition:
                  "lamp, light (piece of furniture or fixture)",
                tags: ["feminine"],
              },
              {
                definition: "bulb, light bulb",
                tags: ["colloquial", "feminine"],
              },
            ],
            forms: [
              { word: "Lampe", tags: ["genitive"] },
              { word: "Lampen", tags: ["plural"] },
              { word: "Lampe", tags: ["genitive", "singular"] },
            ],
          },
        ],
      },
      "Lampe",
      "Substantiv",
    );

    expect(result?.definitionEn).toContain("lamp, light");
    expect(result?.definitionEn).toContain("bulb, light bulb");
    expect(result?.formsJson?.plural).toBe("Lampen");
    expect(result?.formsJson?.genitive).toBe("Lampe");
    expect(result?.dictionaryLicense).toBe("CC BY-SA 4.0");
  });

  it("returns null when the German word is missing", () => {
    expect(
      parseFreeDictionaryResponse(
        {
          word: "zzzzzz",
          entries: [],
        },
        "zzzzzz",
        null,
      ),
    ).toBeNull();
  });

  it("keeps every reading of a spelling that has several", () => {
    // The real answer for "wollen": the adjective reading (wool) and the verb
    // reading (to want) arrive as two entries, and the word book entry must be
    // able to show both.
    const result = parseFreeDictionaryResponse(
      {
        word: "wollen",
        entries: [
          {
            language: { code: "de" },
            partOfSpeech: "adjective",
            senses: [
              {
                definition: "(relational) wool; woolen, woollen",
                tags: ["not comparable", "relational"],
              },
            ],
          },
          {
            language: { code: "de" },
            partOfSpeech: "verb",
            senses: [
              {
                definition:
                  "(transitive or intransitive) to want; to wish; to desire; to demand",
                tags: ["transitive"],
              },
              {
                definition: "(auxiliary) to intend, to mean",
                tags: ["auxiliary"],
              },
            ],
          },
        ],
      },
      "wollen",
      "Verb",
    );

    expect(result?.senses.map((sense) => sense.partOfSpeech)).toEqual([
      "adjective",
      "verb",
      "verb",
    ]);
    expect(result?.senses[1]).toMatchObject({
      text: "(transitive or intransitive) to want; to wish; to desire; to demand",
      tags: ["transitive"],
      order: 0,
      entryOrder: 1,
    });
    // The stored one-line definition still follows the part of speech the entry
    // was resolved to, so the word page and the card agree.
    expect(result?.definitionEn).toContain("to want");
  });

  it("drops duplicate wording across entries", () => {
    const result = parseFreeDictionaryResponse(
      {
        word: "wollen",
        entries: [
          {
            language: { code: "de" },
            partOfSpeech: "verb",
            senses: [{ definition: "to want" }],
          },
          {
            language: { code: "de" },
            partOfSpeech: "adjective",
            senses: [{ definition: "To Want" }, { definition: "wool" }],
          },
        ],
      },
      "wollen",
      "Verb",
    );

    expect(result?.senses.map((sense) => sense.text)).toEqual([
      "to want",
      "wool",
    ]);
  });

  it("replaces a grouped label sense with its subsenses", () => {
    // Wiktionary labels the copulative meaning "As a copulative verb:" and
    // keeps the wording in subsenses; the label alone is not a meaning.
    const result = parseFreeDictionaryResponse(
      {
        word: "sein",
        entries: [
          {
            language: { code: "de" },
            partOfSpeech: "verb",
            senses: [
              {
                definition: "(auxiliary) forms the perfect tenses",
                tags: ["auxiliary"],
              },
              {
                definition: "As a copulative verb:",
                tags: [],
                subsenses: [
                  {
                    definition: "(with a predicate) to be",
                    tags: ["irregular"],
                  },
                  { definition: "to exist, be alive", tags: ["irregular"] },
                ],
              },
            ],
          },
        ],
      },
      "sein",
      "Verb",
    );

    expect(result?.senses.map((sense) => sense.text)).toEqual([
      "(auxiliary) forms the perfect tenses",
      "(with a predicate) to be",
      "to exist, be alive",
    ]);
    expect(result?.senses[1].tags).toEqual(["irregular"]);
    expect(result?.definitionEn).not.toContain("As a copulative verb:");
  });
});
