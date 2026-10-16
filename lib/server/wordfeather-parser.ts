import { parse } from "node-html-parser";

export type WordfeatherVocabularyEntry = {
  level: string;
  lemma: string;
  normalizedLemma: string;
  partOfSpeech: string;
  translationEn: string | null;
  exampleDe: string | null;
  sourceUrl: string;
  license: string;
  confidence: number;
};

const WORDFEATHER_LICENSE = "CC BY-NC 4.0";

function normalizeLemma(value: string): string {
  return value.normalize("NFC").trim().toLowerCase();
}

function cleanDisplayLemma(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*[-–—].*$/u, "")
    .replace(/\s*\((?:Pl\.|Sg\.|nur Pl\.|nur Sg\.)\)\s*/giu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function lemmatize(rawValue: string, partOfSpeech: string): string {
  let value = cleanDisplayLemma(rawValue);

  if (partOfSpeech === "noun") {
    value = value.replace(/^(der|die|das)\s+/iu, "");
  }

  value = value.replace(/^sich\s+/iu, "");

  return value.trim();
}

export function parseWordfeatherVocabulary(
  html: string,
  level: string,
  sourceUrl: string,
): WordfeatherVocabularyEntry[] {
  const root = parse(html);
  const entries = new Map<string, WordfeatherVocabularyEntry>();

  for (const row of root.querySelectorAll("tr")) {
    const deCell = row.querySelector(".de-word");

    if (!deCell) {
      continue;
    }

    for (const button of deCell.querySelectorAll("button")) {
      button.remove();
    }

    const displayLemma = cleanDisplayLemma(deCell.text);
    const cells = row.querySelectorAll("td");
    const translationEn = cells[1]?.text.trim() || null;
    const exampleDe = cells[2]?.text.trim() || null;
    const partOfSpeech = row.getAttribute("data-pos") ?? "";
    const lemma = lemmatize(displayLemma, partOfSpeech);

    if (!lemma) {
      continue;
    }

    const entry: WordfeatherVocabularyEntry = {
      level,
      lemma,
      normalizedLemma: normalizeLemma(lemma),
      partOfSpeech,
      translationEn,
      exampleDe,
      sourceUrl,
      license: WORDFEATHER_LICENSE,
      confidence: 0.8,
    };

    entries.set(
      `${entry.normalizedLemma}|${entry.level}|${entry.partOfSpeech}`,
      entry,
    );
  }

  return Array.from(entries.values());
}
