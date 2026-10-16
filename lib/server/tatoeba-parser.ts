/**
 * Pure parser for the Tatoeba `api_v0/search` response. Kept free of network
 * and database access so the ranking rules can be unit tested.
 */

export type TatoebaSentence = {
  id: number;
  text: string;
  translation: string | null;
  translationLanguage: string | null;
  author: string | null;
  license: string;
  sourceUrl: string | null;
};

export const TATOEBA_SOURCE_URL = "https://tatoeba.org/en/sentences/show";
export const TATOEBA_DEFAULT_LICENSE = "CC BY 2.0 FR";

/** Tatoeba reports Mandarin Chinese as `cmn` (zh-Hans / zh-Hant scripts). */
const MANDARIN_LANGUAGE = "cmn";
const MIN_WORDS = 4;
const MAX_WORDS = 16;
const MAX_CHARS = 120;
const DEFAULT_LIMIT = 5;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function normalizeValue(value: string): string {
  return value.normalize("NFC").trim().toLowerCase();
}

function normalizedKey(text: string): string {
  return normalizeValue(text).replace(/[.!?…»«"„“”]+$/u, "").trim();
}

function wordCount(text: string): number {
  return text.split(/\s+/u).filter(Boolean).length;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Whole-word match so that `Haus` does not match `Hausaufgabe`.
 */
function containsForm(text: string, forms: readonly string[]): boolean {
  const normalizedText = normalizeValue(text);

  return forms.some((form) => {
    if (!form) {
      return false;
    }

    try {
      return new RegExp(
        `(?<![\\p{L}\\p{N}])${escapeRegExp(normalizeValue(form))}(?![\\p{L}\\p{N}])`,
        "u",
      ).test(normalizedText);
    } catch {
      return normalizedText.includes(normalizeValue(form));
    }
  });
}

function translationsOf(record: Record<string, unknown>): Array<
  Record<string, unknown>
> {
  const groups = record.translations;

  if (!Array.isArray(groups)) {
    return [];
  }

  return groups.flatMap((group) => {
    if (!Array.isArray(group)) {
      return [];
    }

    return group
      .map(asRecord)
      .filter((item): item is Record<string, unknown> => item !== null);
  });
}

/**
 * Sentences that carry a community Chinese translation rank first, then the
 * shortest sentences, because the example card favours learner-sized usage.
 */
export function parseTatoebaSentences(
  raw: unknown,
  options: {
    lemma: string;
    forms?: readonly string[];
    limit?: number;
  },
): TatoebaSentence[] {
  const results = asRecord(raw)?.results;

  if (!Array.isArray(results)) {
    return [];
  }

  const forms = Array.from(
    new Set(
      [options.lemma, ...(options.forms ?? [])]
        .map((form) => form.trim())
        .filter(Boolean),
    ),
  );
  const limit = options.limit ?? DEFAULT_LIMIT;
  const seen = new Set<string>();
  const candidates: Array<{ sentence: TatoebaSentence; words: number }> = [];

  for (const entry of results) {
    const record = asRecord(entry);

    if (!record) {
      continue;
    }

    const id = typeof record.id === "number" ? record.id : null;
    const text = typeof record.text === "string" ? record.text.trim() : "";

    if (id === null || !text) {
      continue;
    }

    if (!containsForm(text, forms)) {
      continue;
    }

    const words = wordCount(text);

    if (words < MIN_WORDS || words > MAX_WORDS || text.length > MAX_CHARS) {
      continue;
    }

    const key = normalizedKey(text);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);

    const mandarin = translationsOf(record).find(
      (translation) => translation.lang === MANDARIN_LANGUAGE,
    );
    const translationText =
      typeof mandarin?.text === "string" ? mandarin.text.trim() : "";

    candidates.push({
      words,
      sentence: {
        id,
        text,
        translation: translationText || null,
        translationLanguage: translationText ? "zh" : null,
        author:
          typeof asRecord(record.user)?.username === "string"
            ? (asRecord(record.user)?.username as string)
            : null,
        license:
          typeof record.license === "string"
            ? record.license
            : TATOEBA_DEFAULT_LICENSE,
        sourceUrl: `${TATOEBA_SOURCE_URL}/${id}`,
      },
    });
  }

  return candidates
    .sort((a, b) => {
      const aHasTranslation = a.sentence.translation ? 0 : 1;
      const bHasTranslation = b.sentence.translation ? 0 : 1;

      return aHasTranslation - bHasTranslation || a.words - b.words;
    })
    .slice(0, limit)
    .map((candidate) => candidate.sentence);
}
