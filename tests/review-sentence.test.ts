import { describe, expect, it } from "vitest";
import {
  buildHighlightTarget,
  highlightText,
  parseGeneratedSentence,
  selectReviewSentence,
  validateGeneratedSentence,
  type ReviewSentenceCandidate,
} from "../lib/review/sentence";
import { findHighlightRanges } from "../lib/review/highlight";

function candidate(
  text: string,
  overrides: Partial<ReviewSentenceCandidate> = {},
): ReviewSentenceCandidate {
  return {
    text,
    translation: null,
    source: "tatoeba",
    sourceUrl: null,
    license: null,
    ...overrides,
  };
}

describe("buildHighlightTarget", () => {
  it("collects the forms a search should look for", () => {
    const target = buildHighlightTarget({
      lemma: "gehen",
      forms: ["gingst"],
      extraForms: ["geh"],
    });

    expect(target.phrase).toBeNull();
    // Curated irregular forms of the same verb are searched as well.
    expect(target.searchForms).toContain("ging");
    expect(target.searchForms).toContain("gingst");
    expect(target.searchForms).toContain("geh");
    expect(target.searchForms).not.toContain("gehen");
  });

  it("treats a multi-word entry as a phrase", () => {
    const target = buildHighlightTarget({ lemma: "Zu Hause" });

    expect(target.phrase).toBe("Zu Hause");
  });
});

describe("selectReviewSentence", () => {
  const target = { lemma: "Haus" };

  it("skips candidates that do not contain the word", () => {
    const picked = selectReviewSentence({
      candidates: [
        candidate("Der Hund ist klein."),
        candidate("Das Haus ist alt."),
      ],
      target,
    });

    expect(picked?.text).toBe("Das Haus ist alt.");
  });

  it("prefers a translated sentence and drops duplicates", () => {
    const picked = selectReviewSentence({
      candidates: [
        candidate("Das Haus ist alt."),
        candidate("Ein Haus mit Garten ist schön.", { translation: "带花园的房子很漂亮。" }),
        candidate("Ein Haus mit Garten ist schön."),
      ],
      target,
    });

    expect(picked?.text).toBe("Ein Haus mit Garten ist schön.");
    expect(picked?.translation).toBe("带花园的房子很漂亮。");
  });

  it("prefers Tatoeba over an OdeNet or AI sentence", () => {
    const picked = selectReviewSentence({
      candidates: [
        candidate("Unser Haus ist sehr groß.", { source: "ai", translation: "我们的房子很大。" }),
        candidate("Das Haus dort gehört mir.", { source: "odenet" }),
        candidate("Mein Haus hat einen Garten."),
      ],
      target,
    });

    expect(picked?.source).toBe("tatoeba");
    expect(picked?.generated).toBe(false);
  });

  it("rotates through the candidates and reports highlight ranges", () => {
    const candidates = [
      candidate("Das Haus ist alt."),
      candidate("Mein Haus ist neu."),
    ];

    const first = selectReviewSentence({ candidates, target, rotation: 0 });
    const second = selectReviewSentence({ candidates, target, rotation: 1 });
    const wrapped = selectReviewSentence({ candidates, target, rotation: 2 });

    expect(first?.text).toBe("Das Haus ist alt.");
    expect(second?.text).toBe("Mein Haus ist neu.");
    expect(wrapped?.text).toBe(first?.text);
    expect(first?.highlightRanges).toEqual([{ start: 4, end: 8 }]);
  });

  it("returns null when nothing contains the word", () => {
    expect(
      selectReviewSentence({
        candidates: [candidate("Der Hund ist klein.")],
        target,
      }),
    ).toBeNull();
    expect(selectReviewSentence({ candidates: [], target })).toBeNull();
  });

  it("keeps the generated flag for an AI sentence", () => {
    const picked = selectReviewSentence({
      candidates: [
        candidate("Das Haus am Meer ist teuer.", {
          source: "ai",
          translation: "海边的房子很贵。",
        }),
      ],
      target,
    });

    expect(picked?.generated).toBe(true);
    expect(picked?.translation).toBe("海边的房子很贵。");
  });
});

describe("highlightText", () => {
  it("returns the highlighted substring", () => {
    const text = "Das Haus ist alt.";
    const ranges = findHighlightRanges(text, { lemma: "Haus" });

    expect(highlightText(text, ranges)).toBe("Haus");
  });

  it("returns an empty string without ranges", () => {
    expect(highlightText("Das Haus ist alt.", [])).toBe("");
  });
});

describe("parseGeneratedSentence", () => {
  it("reads a plain JSON object", () => {
    expect(
      parseGeneratedSentence('{"sentence": "Das Haus ist alt.", "translation": "这房子很旧。"}'),
    ).toEqual({ sentence: "Das Haus ist alt.", translation: "这房子很旧。" });
  });

  it("tolerates a fenced code block and surrounding prose", () => {
    const raw = [
      "好的，例句如下：",
      "```json",
      '{"sentence": "Mein Haus ist klein.", "translation": "我的房子很小。"}',
      "```",
    ].join("\n");

    expect(parseGeneratedSentence(raw)).toEqual({
      sentence: "Mein Haus ist klein.",
      translation: "我的房子很小。",
    });
  });

  it("rejects broken or incomplete payloads", () => {
    expect(parseGeneratedSentence("没有 JSON")).toBeNull();
    expect(parseGeneratedSentence('{"sentence": ""}')).toBeNull();
    expect(parseGeneratedSentence("{nope}")).toBeNull();
  });
});

describe("validateGeneratedSentence", () => {
  const target = { lemma: "Haus" };

  it("accepts a learner-sized sentence that contains the word", () => {
    expect(
      validateGeneratedSentence({
        sentence: "Unser Haus am Meer ist sehr teuer geworden.",
        translation: "我们在海边的房子变得很贵。",
        target,
      }),
    ).toBe(true);
  });

  it("rejects a sentence without the word, a missing translation or a bad length", () => {
    expect(
      validateGeneratedSentence({
        sentence: "Der Hund läuft schnell über die Straße.",
        translation: "狗很快跑过街道。",
        target,
      }),
    ).toBe(false);
    expect(
      validateGeneratedSentence({
        sentence: "Das Haus ist groß.",
        translation: "   ",
        target,
      }),
    ).toBe(false);
    expect(
      validateGeneratedSentence({
        sentence: "Haus.",
        translation: "房子。",
        target,
      }),
    ).toBe(false);
  });
});
