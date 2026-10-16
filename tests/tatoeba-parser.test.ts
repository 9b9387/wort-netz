import { describe, expect, it } from "vitest";
import { parseTatoebaSentences } from "../lib/server/tatoeba-parser";

function response(results: unknown[]) {
  return { paging: { Sentences: { count: results.length } }, results };
}

function sentence(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    text: "Ich habe große Sehnsucht nach den Bergen.",
    lang: "deu",
    license: "CC BY 2.0 FR",
    user: { username: "author" },
    translations: [[], []],
    ...overrides,
  };
}

describe("parseTatoebaSentences", () => {
  it("keeps sentences that use the lemma and reads Chinese translations", () => {
    const result = parseTatoebaSentences(
      response([
        sentence({
          id: 42,
          translations: [
            [{ id: 7, lang: "eng", text: "I long for the mountains." }],
            [{ id: 8, lang: "cmn", text: "我非常想念群山。", lang_tag: "zh-Hans" }],
          ],
        }),
      ]),
      { lemma: "Sehnsucht" },
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 42,
      text: "Ich habe große Sehnsucht nach den Bergen.",
      translation: "我非常想念群山。",
      translationLanguage: "zh",
      author: "author",
      license: "CC BY 2.0 FR",
      sourceUrl: "https://tatoeba.org/en/sentences/show/42",
    });
  });

  it("accepts inflected forms but rejects compounds", () => {
    const result = parseTatoebaSentences(
      response([
        sentence({ id: 1, text: "Die alten Häuser stehen am Fluss." }),
        sentence({ id: 2, text: "Die Hausaufgabe ist heute sehr lang." }),
        sentence({ id: 3, text: "Das Haus am See ist wirklich sehr schön." }),
      ]),
      { lemma: "Haus", forms: ["Häuser"] },
    );

    expect(result.map((item) => item.id)).toEqual([1, 3]);
  });

  it("drops sentences that are too short, too long or duplicated", () => {
    const result = parseTatoebaSentences(
      response([
        sentence({ id: 1, text: "Haus!" }),
        sentence({
          id: 2,
          text: "Das Haus, in dem ich als Kind mit meiner ganzen Familie in einem kleinen Dorf im Süden von Bayern gewohnt habe, ist verkauft worden.",
        }),
        sentence({ id: 3, text: "Das Haus am See ist wirklich sehr schön." }),
        sentence({ id: 4, text: "das haus am see ist wirklich sehr schön." }),
      ]),
      { lemma: "Haus" },
    );

    expect(result.map((item) => item.id)).toEqual([3]);
  });

  it("ranks community translations first and respects the limit", () => {
    const result = parseTatoebaSentences(
      response([
        sentence({
          id: 1,
          text: "Das Haus am See ist wirklich sehr schön.",
        }),
        sentence({
          id: 2,
          text: "Wir kaufen heute ein neues Haus für die Familie.",
          translations: [[{ id: 9, lang: "cmn", text: "我们今天给家里买新房子。" }]],
        }),
      ]),
      { lemma: "Haus", limit: 1 },
    );

    expect(result.map((item) => item.id)).toEqual([2]);
  });

  it("returns an empty list for unexpected payloads", () => {
    expect(parseTatoebaSentences(null, { lemma: "Haus" })).toEqual([]);
    expect(parseTatoebaSentences({ results: "nope" }, { lemma: "Haus" })).toEqual(
      [],
    );
  });
});
