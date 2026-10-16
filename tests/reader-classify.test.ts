import { describe, expect, it } from "vitest";
import {
  classifySurface,
  emptyLexicon,
  type GlobalWordFact,
  type ReaderLexicon,
  type UserWordFact,
} from "../lib/reader/classify";

function userFact(overrides: Partial<UserWordFact> = {}): UserWordFact {
  return {
    lexemeId: "11111111-1111-1111-1111-111111111111",
    lemma: "gehen",
    isFavorite: false,
    dueAt: null,
    status: "NEW",
    ...overrides,
  };
}

function globalFact(overrides: Partial<GlobalWordFact> = {}): GlobalWordFact {
  return {
    lexemeId: null,
    lemma: "Haus",
    pos: "Substantiv",
    level: "A1",
    basic: true,
    ...overrides,
  };
}

function lexicon({
  userForms = [],
  globalLemmas = [],
}: {
  userForms?: Array<[string, UserWordFact]>;
  globalLemmas?: Array<[string, GlobalWordFact]>;
}): ReaderLexicon {
  const base = emptyLexicon();

  for (const [key, value] of userForms) {
    base.userForms.set(key, value);
  }

  for (const [key, value] of globalLemmas) {
    base.globalLemmas.set(key, value);
  }

  return base;
}

describe("classifySurface", () => {
  it("classifies an exact dictionary hit as unlearned", () => {
    const result = classifySurface(
      "Haus",
      lexicon({ globalLemmas: [["haus", globalFact()]] }),
    );

    expect(result.category).toBe("unlearned");
    expect(result.match).toBe("exact");
  });

  it("marks an inflected form as learned through the user's word book", () => {
    const result = classifySurface(
      "ging",
      lexicon({ userForms: [["ging", userFact()]] }),
    );

    expect(result.category).toBe("learned");
    expect(result.lemma).toBe("gehen");
    expect(result.match).toBe("form");
    expect(result.inWordBook).toBe(true);
  });

  it("prefers the user's word over the global dictionary", () => {
    const result = classifySurface(
      "Häusern",
      lexicon({
        userForms: [
          [
            "haus",
            userFact({
              lexemeId: "22222222-2222-2222-2222-222222222222",
              lemma: "Haus",
              isFavorite: true,
            }),
          ],
        ],
        globalLemmas: [["haus", globalFact()]],
      }),
    );

    expect(result.category).toBe("learned");
    expect(result.lexemeId).toBe("22222222-2222-2222-2222-222222222222");
    expect(result.isFavorite).toBe(true);
    expect(result.match).toBe("rule");
  });

  it("reports an unlearned word with its CEFR level and part of speech", () => {
    const result = classifySurface(
      "Häusern",
      lexicon({ globalLemmas: [["haus", globalFact()]] }),
    );

    expect(result.category).toBe("unlearned");
    expect(result.lemma).toBe("Haus");
    expect(result.level).toBe("A1");
    expect(result.pos).toBe("Substantiv");
    expect(result.inWordBook).toBe(false);
  });

  it("resolves compounds when both parts are real words", () => {
    const result = classifySurface(
      "Hausaufgaben",
      lexicon({
        globalLemmas: [
          ["haus", globalFact({ lemma: "Haus", level: "A1" })],
          ["aufgabe", globalFact({ lemma: "Aufgabe", level: "A2" })],
        ],
      }),
    );

    expect(result.category).toBe("unlearned");
    expect(result.lemma).toBe("Aufgabe");
    expect(result.match).toBe("rule");
  });

  it("does not invent a compound for names or unknown words", () => {
    // Regression: "Tillmanns" was split into "till" + "manns" and filed under
    // the noun "Mann", so clicking the name opened the entry for "Mann".
    const result = classifySurface(
      "Tillmanns",
      lexicon({
        globalLemmas: [["mann", globalFact({ lemma: "Mann", level: "A1" })]],
      }),
    );

    expect(result.category).toBe("unrecognized");
    expect(result.lemma).toBeNull();
  });

  it("still resolves a compound whose head is the user's word", () => {
    const result = classifySurface(
      "Hausaufgaben",
      lexicon({
        userForms: [
          [
            "aufgabe",
            userFact({
              lexemeId: "66666666-6666-6666-6666-666666666666",
              lemma: "Aufgabe",
            }),
          ],
        ],
        globalLemmas: [["haus", globalFact({ lemma: "Haus", level: "A1" })]],
      }),
    );

    expect(result.category).toBe("learned");
    expect(result.lemma).toBe("Aufgabe");
  });

  it("leaves unknown words unrecognized and flags function words", () => {
    const unknown = classifySurface("Xyzzy", emptyLexicon());
    const functionWord = classifySurface("und", emptyLexicon());

    expect(unknown.category).toBe("unrecognized");
    expect(unknown.match).toBe("none");
    expect(unknown.isFunctionWord).toBe(false);
    expect(functionWord.category).toBe("unrecognized");
    expect(functionWord.isFunctionWord).toBe(true);
  });

  it("keeps a collected function word in the learned category", () => {
    const result = classifySurface(
      "und",
      lexicon({
        userForms: [
          [
            "und",
            userFact({ lemma: "und", lexemeId: "33333333-3333-3333-3333-333333333333" }),
          ],
        ],
      }),
    );

    expect(result.category).toBe("learned");
    expect(result.isFunctionWord).toBe(true);
  });

  it("ignores an obscure entry reached only by a guessed word form", () => {
    // Regression: "gone" resolved to OdeNet's non-basic entry "Gon" via the
    // "-e" strip, so the reader promised a word the click could never open.
    const result = classifySurface(
      "gone",
      lexicon({
        globalLemmas: [
          [
            "gon",
            globalFact({
              lemma: "Gon",
              level: null,
              basic: false,
              lexemeId: null,
            }),
          ],
        ],
      }),
    );

    expect(result.category).toBe("unrecognized");
    expect(result.lemma).toBeNull();
  });

  it("still resolves guessed forms onto common vocabulary", () => {
    const result = classifySurface(
      "Häusern",
      lexicon({
        globalLemmas: [["haus", globalFact({ basic: true })]],
      }),
    );

    expect(result.category).toBe("unlearned");
    expect(result.lemma).toBe("Haus");
  });

  it("trusts the exact form even when the entry is not basic vocabulary", () => {
    const result = classifySurface(
      "Gon",
      lexicon({
        globalLemmas: [
          [
            "gon",
            globalFact({
              lemma: "Gon",
              level: null,
              basic: false,
              lexemeId: null,
            }),
          ],
        ],
      }),
    );

    expect(result.category).toBe("unlearned");
    expect(result.match).toBe("exact");
  });

  it("does not file a possessive under the verb sein", () => {
    // Regression: stripping the case ending from "seine" produced "sein", so a
    // possessive was counted as the verb the user had already collected.
    const withUserVerb = classifySurface(
      "seine",
      lexicon({
        userForms: [
          [
            "sein",
            userFact({
              lexemeId: "44444444-4444-4444-4444-444444444444",
              lemma: "sein",
            }),
          ],
        ],
      }),
    );
    const withOwnEntry = classifySurface(
      "seine",
      lexicon({
        globalLemmas: [
          [
            "seine",
            globalFact({
              lemma: "seine",
              pos: "Artikel",
              level: null,
              basic: false,
            }),
          ],
        ],
      }),
    );

    expect(withUserVerb.category).toBe("unrecognized");
    expect(withUserVerb.lemma).toBeNull();
    expect(withOwnEntry.category).toBe("unlearned");
    expect(withOwnEntry.lemma).toBe("seine");
  });

  it("keeps resolving the verb forms themselves", () => {
    const result = classifySurface(
      "ist",
      lexicon({
        userForms: [
          [
            "ist",
            userFact({
              lexemeId: "55555555-5555-5555-5555-555555555555",
              lemma: "sein",
            }),
          ],
        ],
      }),
    );

    expect(result.category).toBe("learned");
    expect(result.lemma).toBe("sein");
  });

  it("prefers the curated past tense over a noun entry with the same spelling", () => {
    // Regression: "waren" used to resolve to OdeNet's noun "Waren" (goods).
    const result = classifySurface(
      "waren",
      lexicon({
        globalLemmas: [
          [
            "waren",
            globalFact({ lemma: "Waren", pos: "Substantiv", basic: false }),
          ],
          ["sein", globalFact({ lemma: "sein", pos: "Verb", basic: true })],
        ],
      }),
    );

    expect(result.category).toBe("unlearned");
    expect(result.lemma).toBe("sein");
    expect(result.match).toBe("form");
  });

  it("marks a curated past tense as learned when the infinitive is collected", () => {
    const result = classifySurface(
      "kam",
      lexicon({
        userForms: [
          [
            "kommen",
            userFact({
              lexemeId: "77777777-7777-7777-7777-777777777777",
              lemma: "kommen",
            }),
          ],
        ],
      }),
    );

    expect(result.category).toBe("learned");
    expect(result.lemma).toBe("kommen");
  });
});
