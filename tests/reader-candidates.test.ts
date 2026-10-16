import { describe, expect, it } from "vitest";
import {
  candidateLemmas,
  compoundSplits,
  foldSharpS,
  foldUmlauts,
  isCandidateLemma,
} from "../lib/reader/candidates";

function lemmas(surface: string): string[] {
  return candidateLemmas(surface).map((candidate) => candidate.lemma);
}

describe("candidateLemmas", () => {
  it("recovers noun plurals and dative forms", () => {
    expect(lemmas("Katzen")).toContain("katze");
    expect(lemmas("Häusern")).toContain("haus");
  });

  it("recovers adjective comparison forms", () => {
    expect(lemmas("schöner")).toContain("schön");
  });

  it("recovers conjugated verb forms through the infinitive", () => {
    expect(lemmas("spielt")).toContain("spielen");
    expect(lemmas("arbeitet")).toContain("arbeiten");
  });

  it("keeps exact matches first and stays bounded", () => {
    const candidates = candidateLemmas("Häusern");

    expect(candidates[0]?.lemma).toBe("häusern");
    expect(candidates.length).toBeLessThanOrEqual(16);
  });

  it("does not invent irregular verb lemmas", () => {
    // Documented limitation: `ging`/`gegangen` only resolve through the
    // entry's forms_json or the user's encountered surface forms.
    expect(lemmas("ging")).not.toContain("gehen");
    expect(lemmas("gegangen")).not.toContain("gehen");
  });

  it("handles the ge- participle prefix for regular verbs", () => {
    expect(lemmas("gearbeitet")).toContain("arbeiten");
  });
});

describe("folding helpers", () => {
  it("folds umlauts and sharp s", () => {
    expect(foldUmlauts("größer")).toBe("großer");
    expect(foldSharpS("Straße")).toBe("Strasse");
  });
});

describe("compoundSplits", () => {
  it("offers modifier/head splits for long compounds", () => {
    const splits = compoundSplits("Hausaufgaben");

    expect(splits.some((split) => split.head === "aufgaben")).toBe(true);
    expect(splits.length).toBeLessThanOrEqual(8);
  });

  it("ignores short words", () => {
    expect(compoundSplits("Haus")).toEqual([]);
  });
});

describe("isCandidateLemma", () => {
  it("accepts the lemmas a surface form really suggests", () => {
    expect(isCandidateLemma("Häusern", "haus")).toBe(true);
    expect(isCandidateLemma("Häusern", "Haus")).toBe(true);
    expect(isCandidateLemma("spielt", "spielen")).toBe(true);
  });

  it("rejects a compound head that was only guessed", () => {
    // "Tillmanns" never suggests "mann"; the guess came from splitting the name.
    expect(isCandidateLemma("Tillmanns", "mann")).toBe(false);
  });
});
