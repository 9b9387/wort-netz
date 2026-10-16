import { describe, expect, it } from "vitest";
import { isDistinctForm } from "../lib/wordbook/form-entry";

describe("isDistinctForm", () => {
  it("treats an inflected form as its own entry", () => {
    expect(isDistinctForm("ist", "sein")).toBe(true);
    expect(isDistinctForm("Häusern", "Haus")).toBe(true);
    expect(isDistinctForm("willst", "wollen")).toBe(true);
  });

  it("keeps the lemma entry when the word is already the lemma", () => {
    expect(isDistinctForm("sein", "sein")).toBe(false);
    expect(isDistinctForm("sein", "Sein")).toBe(false);
    expect(isDistinctForm(" Haus ", "Haus")).toBe(false);
  });
});
