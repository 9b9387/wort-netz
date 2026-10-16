import { describe, expect, it } from "vitest";
import {
  frequencyStars,
  normalizeForms,
  resolveDefinitions,
} from "../lib/word-display";

describe("frequencyStars", () => {
  it("inverts the DWDS frequency class into filled stars", () => {
    expect(frequencyStars(1)).toBe(6);
    expect(frequencyStars(3)).toBe(4);
    expect(frequencyStars(6)).toBe(1);
  });

  it("handles missing and out-of-range values", () => {
    expect(frequencyStars(null)).toBe(0);
    expect(frequencyStars(undefined)).toBe(0);
    expect(frequencyStars(0)).toBe(6);
    expect(frequencyStars(99)).toBe(1);
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
