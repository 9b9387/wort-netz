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
});
