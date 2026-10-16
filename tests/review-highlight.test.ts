import { describe, expect, it } from "vitest";
import {
  containsTarget,
  findHighlightRanges,
  splitHighlightedText,
} from "../lib/review/highlight";

describe("findHighlightRanges", () => {
  it("finds the exact form", () => {
    const sentence = "Das Haus ist alt.";
    const ranges = findHighlightRanges(sentence, { lemma: "Haus" });

    expect(ranges).toEqual([{ start: 4, end: 8 }]);
    expect(sentence.slice(4, 8)).toBe("Haus");
  });

  it("finds inflected forms through the suffix rules", () => {
    expect(
      findHighlightRanges("Wir gehen in die Häusern?", { lemma: "Haus" }),
    ).toEqual([{ start: 17, end: 24 }]);
    expect(
      containsTarget("Sie geht jeden Tag zur Arbeit.", { lemma: "gehen" }),
    ).toBe(true);
    expect(
      containsTarget("Er macht das jeden Tag.", { lemma: "machen" }),
    ).toBe(true);
  });

  it("uses the curated irregular verb table", () => {
    expect(containsTarget("Er ging nach Hause.", { lemma: "gehen" })).toBe(true);
    expect(containsTarget("Er ist gegangen.", { lemma: "gehen" })).toBe(true);
    expect(containsTarget("Sie war müde.", { lemma: "sein" })).toBe(true);
  });

  it("accepts the forms the entry itself carries", () => {
    expect(
      containsTarget("Die Kinder spielten draußen.", {
        lemma: "Kind",
        forms: ["Kinder"],
      }),
    ).toBe(true);
  });

  it("does not match a longer compound word", () => {
    expect(containsTarget("Die Hausaufgabe war schwer.", { lemma: "Haus" })).toBe(
      false,
    );
    expect(
      findHighlightRanges("Die Hausaufgabe und das Haus", { lemma: "Haus" }),
    ).toEqual([{ start: 24, end: 28 }]);
  });

  it("highlights every occurrence", () => {
    const sentence = "Der Hund bellt, der Hund läuft.";
    const ranges = findHighlightRanges(sentence, { lemma: "Hund" });

    expect(ranges).toEqual([
      { start: 4, end: 8 },
      { start: 20, end: 24 },
    ]);
  });

  it("matches a whole multi-word expression", () => {
    const sentence = "Ich bleibe heute zu Hause.";
    const ranges = findHighlightRanges(sentence, {
      lemma: "Zu Hause",
      phrase: "Zu Hause",
    });

    expect(ranges).toEqual([{ start: 17, end: 25 }]);
    expect(sentence.slice(17, 25)).toBe("zu Hause");
  });

  it("returns nothing when the word is absent or the input is empty", () => {
    expect(findHighlightRanges("Ein ganz anderer Satz.", { lemma: "Haus" })).toEqual(
      [],
    );
    expect(findHighlightRanges("   ", { lemma: "Haus" })).toEqual([]);
  });
});

describe("splitHighlightedText", () => {
  it("cuts the sentence into plain and highlighted segments", () => {
    const segments = splitHighlightedText("Das Haus ist alt.", [
      { start: 4, end: 8 },
    ]);

    expect(segments).toEqual([
      { text: "Das ", highlight: false },
      { text: "Haus", highlight: true },
      { text: " ist alt.", highlight: false },
    ]);
  });

  it("ignores unusable ranges and keeps the whole text", () => {
    expect(splitHighlightedText("Abc", [])).toEqual([
      { text: "Abc", highlight: false },
    ]);
    expect(
      splitHighlightedText("Abc", [{ start: 2, end: 99 }]).map(
        (segment) => segment.text,
      ),
    ).toEqual(["Abc"]);
  });
});
