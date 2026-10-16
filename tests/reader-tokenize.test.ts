import { describe, expect, it } from "vitest";
import { normalizeSurface, tokenizeWords } from "../lib/reader/tokenize";

describe("tokenizeWords", () => {
  it("returns offsets that slice back to the original word", () => {
    const text = "Der Hund läuft über die Straße.";

    for (const token of tokenizeWords(text)) {
      expect(text.slice(token.start, token.end)).toBe(token.text);
    }
  });

  it("keeps umlauts and sharp s intact", () => {
    const text = "Die Straße war groß; der Fußball-Platz auch.";
    const tokens = tokenizeWords(text);

    expect(tokens.map((token) => token.text)).toContain("Straße");
    expect(tokens.map((token) => token.text)).toContain("groß");
    // Hyphenated compounds split into their parts so each part can be looked
    // up on its own; the hyphen itself is not a token.
    expect(tokens.map((token) => token.text)).toContain("Fußball");
    expect(tokens.map((token) => token.text)).toContain("Platz");
    expect(tokens.map((token) => token.text)).not.toContain("-");
  });

  it("skips punctuation, digits and whitespace", () => {
    const tokens = tokenizeWords("Am 3. Mai kam er – wirklich?!");

    expect(tokens.map((token) => token.text)).toEqual([
      "Am",
      "Mai",
      "kam",
      "er",
      "wirklich",
    ]);
  });

  it("keeps offsets stable across paragraphs", () => {
    const text = "Erster Satz.\n\nZweiter Satz mit Häusern.";
    const tokens = tokenizeWords(text);
    const last = tokens[tokens.length - 1];

    expect(text.slice(last.start, last.end)).toBe("Häusern");
    expect(last.start).toBe(text.lastIndexOf("Häusern"));
  });
});

describe("normalizeSurface", () => {
  it("lowercases and trims like the dictionary normalization", () => {
    expect(normalizeSurface("  HäUSER ")).toBe("häuser");
  });
});
