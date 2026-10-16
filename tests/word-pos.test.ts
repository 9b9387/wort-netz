import { describe, expect, it } from "vitest";
import {
  chooseSnippetEntry,
  dictionaryPartOfSpeech,
  inferSurfacePartOfSpeech,
  wordTypeFamily,
} from "../lib/word-pos";

describe("wordTypeFamily", () => {
  it("maps the DWDS Wortarten used by the app", () => {
    expect(wordTypeFamily("Substantiv")).toBe("noun");
    expect(wordTypeFamily("Eigenname")).toBe("noun");
    expect(wordTypeFamily("Verb")).toBe("verb");
    expect(wordTypeFamily("Adjektiv")).toBe("adjective");
    expect(wordTypeFamily("Adverb")).toBe("adverb");
    // "adverb" contains "verb", so the family check must not stop at the verb.
    expect(wordTypeFamily("Pronominaladverb")).toBe("adverb");
    expect(wordTypeFamily("Personalpronomen")).toBe("pronoun");
    expect(wordTypeFamily("Präposition")).toBe("preposition");
    expect(wordTypeFamily("Konjunktion")).toBe("conjunction");
    expect(wordTypeFamily(null)).toBeNull();
  });

  it("maps to the part of speech the English dictionary uses", () => {
    expect(dictionaryPartOfSpeech("Substantiv")).toBe("noun");
    expect(dictionaryPartOfSpeech("Verb")).toBe("verb");
    expect(dictionaryPartOfSpeech("Adjektiv")).toBe("adjective");
    expect(dictionaryPartOfSpeech("Präposition")).toBe("preposition");
    // Word classes Wiktionary does not label the same way.
    expect(dictionaryPartOfSpeech("Numerale")).toBeNull();
    expect(dictionaryPartOfSpeech(null)).toBeNull();
  });
});

describe("inferSurfacePartOfSpeech", () => {
  it("reads a capitalized query as a noun", () => {
    expect(inferSurfacePartOfSpeech("Lampe")).toEqual({
      family: "noun",
      strength: "strong",
    });
  });

  it("uses the curated irregular verb table", () => {
    // "willst" is the form that used to resolve to the adjective "wollen".
    expect(inferSurfacePartOfSpeech("willst")).toEqual({
      family: "verb",
      strength: "strong",
    });
    expect(inferSurfacePartOfSpeech("ging")).toEqual({
      family: "verb",
      strength: "strong",
    });
  });

  it("falls back to a verb-shaped ending", () => {
    expect(inferSurfacePartOfSpeech("machst")).toEqual({
      family: "verb",
      strength: "weak",
    });
    // An infinitive shape is a weak signal too, so a bare "wollen" prefers the
    // verb reading of DWDS over the adjective.
    expect(inferSurfacePartOfSpeech("wollen")).toEqual({
      family: "verb",
      strength: "weak",
    });
  });

  it("stays silent when the form carries no signal", () => {
    // Too short to look like an infinitive: "sein" keeps the DWDS order.
    expect(inferSurfacePartOfSpeech("sein")).toBeNull();
    expect(inferSurfacePartOfSpeech("her")).toBeNull();
    expect(inferSurfacePartOfSpeech("")).toBeNull();
  });
});

describe("chooseSnippetEntry", () => {
  // The real DWDS answer for "willst": the adjective reading comes first.
  const wollenSnippets = [
    { wortart: "Adjektiv", lemma: "wollen", url: "https://www.dwds.de/wb/wollen#1" },
    { wortart: "Verb", lemma: "wollen", url: "https://www.dwds.de/wb/wollen#2" },
  ];

  it("picks the reading the queried form belongs to", () => {
    expect(chooseSnippetEntry(wollenSnippets, "willst")?.wortart).toBe("Verb");
  });

  it("prefers the common noun over a proper noun for a capitalized query", () => {
    const lampe = [
      { wortart: "Eigenname", lemma: "Lampe" },
      { wortart: "Substantiv", lemma: "Lampe" },
    ];

    expect(chooseSnippetEntry(lampe, "Lampe")?.wortart).toBe("Substantiv");
  });

  it("prefers the verb for an infinitive-shaped bare lemma", () => {
    expect(chooseSnippetEntry(wollenSnippets, "wollen")?.wortart).toBe(
      "Verb",
    );
  });

  it("keeps the DWDS order when the query carries no signal", () => {
    expect(chooseSnippetEntry(wollenSnippets, "her")?.wortart).toBe("Adjektiv");
    expect(chooseSnippetEntry(wollenSnippets, "sein")?.wortart).toBe(
      "Adjektiv",
    );
  });

  it("handles a single entry and an empty response", () => {
    const single = [{ wortart: "Verb", lemma: "gehen" }];

    expect(chooseSnippetEntry(single, "ging")?.wortart).toBe("Verb");
    expect(chooseSnippetEntry([], "ging")).toBeNull();
  });
});
