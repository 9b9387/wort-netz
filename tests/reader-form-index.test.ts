import { describe, expect, it } from "vitest";
import {
  extractIndexableForms,
  isFunctionWordType,
  shouldIndexForms,
} from "../lib/reader/form-index";

describe("isFunctionWordType", () => {
  it("matches DWDS word types regardless of case", () => {
    // Regression: a case-sensitive check let "Personalpronomen" through, which
    // indexed `er` as a form of `wir` (the Wiktionary pronoun table).
    expect(isFunctionWordType("Personalpronomen")).toBe(true);
    expect(isFunctionWordType("bestimmter Artikel")).toBe(true);
    expect(isFunctionWordType("Präposition")).toBe(true);
    expect(isFunctionWordType("Substantiv")).toBe(false);
    expect(isFunctionWordType("Verb")).toBe(false);
    expect(isFunctionWordType(null)).toBe(false);
  });
});

describe("shouldIndexForms", () => {
  it("indexes content words and skips function-word tables", () => {
    expect(shouldIndexForms("Verb")).toBe(true);
    expect(shouldIndexForms("Substantiv")).toBe(true);
    expect(shouldIndexForms("Personalpronomen")).toBe(false);
    expect(shouldIndexForms("Demonstrativpronomen")).toBe(false);
  });
});

describe("extractIndexableForms", () => {
  it("keeps plain single-word inflections", () => {
    expect(
      extractIndexableForms({
        forms: [
          { word: "Katzen", tags: ["plural"] },
          { word: "Katze", tags: ["nominative", "singular"] },
        ],
      }),
    ).toEqual(["Katzen", "Katze"]);
  });

  it("drops multiword, hyphen-prefixed, numeric and noisy entries", () => {
    expect(
      extractIndexableForms({
        forms: [
          { word: "habe gebeten", tags: [] },
          { word: "-se", tags: [] },
          { word: "class 5", tags: [] },
          { word: "Kätze", tags: ["alternative"] },
          { word: "Kätzchen", tags: ["diminutive"] },
          { word: "Kater", tags: ["masculine"] },
          { word: "gebeten", tags: ["participle", "past"] },
        ],
      }),
    ).toEqual(["Kater", "gebeten"]);
  });

  it("tolerates malformed payloads", () => {
    expect(extractIndexableForms(null)).toEqual([]);
    expect(extractIndexableForms("forms")).toEqual([]);
    expect(extractIndexableForms({ forms: "nope" })).toEqual([]);
    expect(extractIndexableForms({ forms: [null, 42, { word: 7 }] })).toEqual(
      [],
    );
  });
});
