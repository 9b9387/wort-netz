import { describe, expect, it } from "vitest";
import {
  normalizeLexeme,
  parseFrequency,
  parseIpa,
  parseSnippet,
} from "../lib/server/dwds";

describe("normalizeLexeme", () => {
  it("lowercases and normalizes Unicode without removing umlauts", () => {
    expect(normalizeLexeme("  HäUSER  ")).toBe("häuser");
    expect(normalizeLexeme("Straße")).toBe("straße");
  });
});

describe("parseFrequency", () => {
  it("extracts lemma and frequency class", () => {
    expect(
      parseFrequency({ q: "ging", lemma: "gehen", frequency: 5 }),
    ).toMatchObject({
      q: "ging",
      lemma: "gehen",
      frequency: 5,
    });
  });
});

describe("parseSnippet", () => {
  it("reads the first dictionary entry", () => {
    expect(
      parseSnippet([
        {
          input: "gehen",
          wortart: "Verb",
          lemma: "gehen",
          url: "https://www.dwds.de/wb/gehen",
        },
      ]),
    ).toEqual({
      input: "gehen",
      wortart: "Verb",
      lemma: "gehen",
      url: "https://www.dwds.de/wb/gehen",
    });
  });
});

describe("parseIpa", () => {
  it("prefers a manually verified pronunciation", () => {
    expect(
      parseIpa([
        { ipa: "ˈɡeːən", status: "auto" },
        { ipa: "ˈɡeːən", status: "proved" },
      ]),
    ).toBe("ˈɡeːən");
  });

  it("returns the first entry when no proved entry exists", () => {
    expect(parseIpa([{ ipa: "ˈhaʊ̯s", status: "auto" }])).toBe("ˈhaʊ̯s");
  });
});
