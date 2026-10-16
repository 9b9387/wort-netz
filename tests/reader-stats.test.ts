import { describe, expect, it } from "vitest";
import { summarizeTokens } from "../lib/reader/stats";
import type { ReaderToken } from "../lib/reader/types";

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

describe("summarizeTokens", () => {
  it("computes coverage over tokens and over distinct words", () => {
    const stats = summarizeTokens([
      token({
        text: "Der",
        lemma: "der",
        category: "learned",
        inWordBook: true,
        isFunctionWord: true,
      }),
      token({ text: "Hund", lemma: "Hund", category: "learned", inWordBook: true }),
      token({ text: "läuft", lemma: "laufen", level: "B1" }),
      token({
        text: "im",
        lemma: "im",
        category: "learned",
        inWordBook: true,
        isFunctionWord: true,
      }),
      token({ text: "Park", lemma: "Park", level: "A2" }),
      token({ text: "herum", category: "unrecognized", lemma: null }),
    ]);

    expect(stats.totalWords).toBe(6);
    expect(stats.uniqueWords).toBe(6);
    expect(stats.learnedWords).toBe(3);
    expect(stats.learnedUnique).toBe(3);
    expect(stats.unlearnedUnique).toBe(2);
    expect(stats.unrecognizedUnique).toBe(1);
    // Coverage ignores the unrecognized word: 3 learned out of 5 identifiable.
    expect(stats.coverageTokenRatio).toBeCloseTo(0.6);
    expect(stats.coverageUniqueRatio).toBeCloseTo(0.6);
    expect(stats.unlearnedRateRatio).toBeCloseTo(0.4);
    expect(stats.functionWordUnique).toBe(2);
    expect(stats.levelHistogram).toEqual({ B1: 1, A2: 1 });
    expect(stats.estimatedLevel).toBe("A2");
  });

  it("counts repeated words once and buckets missing levels as unknown", () => {
    const stats = summarizeTokens([
      token({ text: "Haus", lemma: "Haus" }),
      token({ text: "Haus", lemma: "Haus", start: 10, end: 14 }),
      token({ text: "Gedöns", lemma: "Gedöns", start: 20, end: 26 }),
    ]);

    expect(stats.uniqueWords).toBe(2);
    expect(stats.unlearnedUnique).toBe(2);
    expect(stats.levelHistogram).toEqual({ unknown: 2 });
    expect(stats.estimatedLevel).toBeNull();
  });

  it("handles an empty article", () => {
    const stats = summarizeTokens([]);

    expect(stats.totalWords).toBe(0);
    expect(stats.coverageTokenRatio).toBe(0);
    expect(stats.coverageUniqueRatio).toBe(0);
    expect(stats.unlearnedRateRatio).toBe(0);
    expect(stats.estimatedLevel).toBeNull();
  });

  it("reports full coverage when every identifiable word is learned", () => {
    const stats = summarizeTokens([
      token({ text: "Hund", lemma: "Hund", category: "learned", inWordBook: true }),
      token({
        text: "Xyzzy",
        lemma: null,
        category: "unrecognized",
        start: 10,
        end: 15,
      }),
    ]);

    expect(stats.coverageTokenRatio).toBe(1);
    expect(stats.coverageUniqueRatio).toBe(1);
    expect(stats.unlearnedRateRatio).toBe(0);
  });

  it("falls back to every word when the unlearned words have no level", () => {
    const stats = summarizeTokens([
      token({ text: "Haus", lemma: "Haus", level: "A1", category: "learned", inWordBook: true }),
      token({ text: "Gedöns", lemma: "Gedöns", start: 10, end: 16 }),
    ]);

    expect(stats.levelHistogram).toEqual({ unknown: 1 });
    expect(stats.estimatedLevel).toBe("A1");
  });
});
