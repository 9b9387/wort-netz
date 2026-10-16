import { describe, expect, it } from "vitest";
import {
  IRREGULAR_VERBS,
  irregularVerbFormCount,
  irregularVerbLemma,
} from "../lib/reader/verb-forms";

describe("irregularVerbLemma", () => {
  it("maps the common past and participle forms to their infinitive", () => {
    expect(irregularVerbLemma("kam")).toBe("kommen");
    expect(irregularVerbLemma("kamen")).toBe("kommen");
    expect(irregularVerbLemma("gewesen")).toBe("sein");
    expect(irregularVerbLemma("waren")).toBe("sein");
    expect(irregularVerbLemma("war")).toBe("sein");
    expect(irregularVerbLemma("hatte")).toBe("haben");
    expect(irregularVerbLemma("gehabt")).toBe("haben");
    expect(irregularVerbLemma("wurde")).toBe("werden");
    expect(irregularVerbLemma("geworden")).toBe("werden");
    expect(irregularVerbLemma("ging")).toBe("gehen");
    expect(irregularVerbLemma("gegangen")).toBe("gehen");
    expect(irregularVerbLemma("wusste")).toBe("wissen");
    expect(irregularVerbLemma("gefahren")).toBe("fahren");
  });

  it("maps modal preterite and subjunctive forms", () => {
    expect(irregularVerbLemma("konnte")).toBe("können");
    expect(irregularVerbLemma("könnte")).toBe("können");
    expect(irregularVerbLemma("musste")).toBe("müssen");
    expect(irregularVerbLemma("hätte")).toBe("haben");
    expect(irregularVerbLemma("wäre")).toBe("sein");
    expect(irregularVerbLemma("möchte")).toBe("mögen");
  });

  it("returns null for regular verbs and unknown words", () => {
    // Regular forms are handled by the suffix rules, not by this table.
    expect(irregularVerbLemma("macht")).toBeNull();
    expect(irregularVerbLemma("haus")).toBeNull();
  });
});

describe("table hygiene", () => {
  it("holds a useful number of forms", () => {
    expect(irregularVerbFormCount()).toBeGreaterThan(300);
  });

  it("stores normalized, non-empty forms", () => {
    for (const verb of IRREGULAR_VERBS) {
      expect(verb.infinitive).toBe(verb.infinitive.toLowerCase());

      for (const form of verb.forms) {
        expect(form).toBe(form.normalize("NFC").trim().toLowerCase());
        expect(form.length).toBeGreaterThan(1);
      }
    }
  });

  it("resolves every listed form to a verb", () => {
    for (const verb of IRREGULAR_VERBS) {
      for (const form of verb.forms) {
        expect(irregularVerbLemma(form)).not.toBeNull();
      }
    }
  });
});
