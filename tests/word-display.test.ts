import { describe, expect, it } from "vitest";
import {
  frequencyStars,
  normalizeForms,
  resolveDefinitionSets,
  resolveDefinitions,
} from "../lib/word-display";

describe("frequencyStars", () => {
  it("follows the DWDS class so more stars mean a more frequent word", () => {
    // Verified against the live API: "und" is class 6, "Xylophon" is class 1.
    expect(frequencyStars(1)).toBe(1);
    expect(frequencyStars(3)).toBe(3);
    expect(frequencyStars(6)).toBe(6);
  });

  it("handles missing, anomalous and out-of-range values", () => {
    expect(frequencyStars(null)).toBe(0);
    expect(frequencyStars(undefined)).toBe(0);
    expect(frequencyStars(0)).toBe(0);
    expect(frequencyStars(99)).toBe(6);
    expect(frequencyStars(2.4)).toBe(2);
  });
});

describe("normalizeForms", () => {
  it("merges duplicate surface forms and drops template noise", () => {
    const forms = normalizeForms([
      { word: "Sehnsüchte", tags: ["plural", "table-tags"] },
      { word: "Sehnsüchte", tags: ["plural"] },
      { word: "Sehnsucht", tags: ["genitive", "singular"] },
      { word: "   ", tags: [] },
    ]);

    expect(forms).toEqual([
      { word: "Sehnsüchte", tags: ["plural"] },
      { word: "Sehnsucht", tags: ["genitive", "singular"] },
    ]);
  });

  it("respects the display limit", () => {
    const forms = Array.from({ length: 20 }, (_, index) => ({
      word: `form-${index}`,
      tags: [],
    }));

    expect(normalizeForms(forms, 3)).toHaveLength(3);
  });
});

describe("resolveDefinitions", () => {
  it("prefers German definitions", () => {
    expect(
      resolveDefinitions({
        german: ["Verlangen nach etwas", "Verlangen nach etwas"],
        english: ["longing"],
      }),
    ).toEqual({ source: "de", items: ["Verlangen nach etwas"] });
  });

  it("falls back to English when German definitions are missing", () => {
    expect(
      resolveDefinitions({ german: [], english: ["longing", "yearning"] }),
    ).toEqual({ source: "en", items: ["longing", "yearning"] });
  });

  it("reports an empty result when nothing is available", () => {
    expect(resolveDefinitions({ german: [], english: ["  "] })).toEqual({
      source: null,
      items: [],
    });
  });
});

describe("resolveDefinitionSets", () => {
  it("returns both languages so English stays visible above the German card", () => {
    expect(
      resolveDefinitionSets({
        german: ["Verlangen nach etwas"],
        english: ["longing", "yearning"],
      }),
    ).toEqual({
      german: ["Verlangen nach etwas"],
      english: ["longing", "yearning"],
    });
  });

  it("deduplicates, trims and limits each language separately", () => {
    expect(
      resolveDefinitionSets({
        german: ["  a  ", "a", ""],
        english: ["x", "x", "y"],
        limit: 2,
      }),
    ).toEqual({ german: ["a"], english: ["x", "y"] });
  });

  it("keeps the German list empty when OdeNet has no German sense", () => {
    expect(
      resolveDefinitionSets({ german: [], english: ["longing"] }),
    ).toEqual({ german: [], english: ["longing"] });
  });
});
