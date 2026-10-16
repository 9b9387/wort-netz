import { describe, expect, it } from "vitest";
import { parseWordfeatherVocabulary } from "../lib/server/wordfeather-parser";

describe("parseWordfeatherVocabulary", () => {
  it("extracts level, lemma, translation and example", () => {
    const entries = parseWordfeatherVocabulary(
      `
      <table>
        <tr data-pos="noun">
          <td class="de-word">der Vater, -̈</td>
          <td>father</td>
          <td>Das ist Laras Vater.</td>
        </tr>
        <tr data-pos="verb">
          <td class="de-word">betreuen <button>Konjugation</button></td>
          <td>to look after</td>
          <td>Sie betreut Kinder.</td>
        </tr>
        <tr data-pos="verb">
          <td class="de-word">sich freuen</td>
          <td>to be happy</td>
          <td>Ich freue mich.</td>
        </tr>
      </table>
      `,
      "A1",
      "https://example.com/A1.html",
    );

    expect(entries).toHaveLength(3);
    expect(entries[0]).toMatchObject({
      level: "A1",
      lemma: "Vater",
      normalizedLemma: "vater",
      partOfSpeech: "noun",
      translationEn: "father",
    });
    expect(entries[1]).toMatchObject({
      lemma: "betreuen",
      normalizedLemma: "betreuen",
      partOfSpeech: "verb",
    });
    expect(entries[2]).toMatchObject({
      lemma: "freuen",
      normalizedLemma: "freuen",
      partOfSpeech: "verb",
    });
  });
});
