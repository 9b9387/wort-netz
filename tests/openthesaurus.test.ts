import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {},
}));

import { parseOpenThesaurusSynonyms } from "../lib/server/openthesaurus";

describe("parseOpenThesaurusSynonyms", () => {
  it("extracts unique single-word synonyms and removes the source lemma", () => {
    const result = parseOpenThesaurusSynonyms(
      {
        synsets: [
          {
            terms: [
              { term: "laufen" },
              { term: "rennen" },
              { term: "rennen" },
              { term: "(schnell) laufen" },
              { term: "Laufen" },
            ],
          },
        ],
      },
      "laufen",
    );

    expect(result).toEqual(["rennen"]);
  });

  it("preserves German umlauts and deduplicates by normalized lemma", () => {
    const result = parseOpenThesaurusSynonyms(
      {
        synsets: [
          {
            terms: [
              { term: "Häuser" },
              { term: "häuser" },
              { term: "Gebäude" },
            ],
          },
        ],
      },
      "Haus",
    );

    expect(result).toEqual(["Häuser", "Gebäude"]);
  });
});
