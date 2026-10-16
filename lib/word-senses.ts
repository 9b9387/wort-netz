/**
 * Structured dictionary senses and the rule that decides their display order.
 *
 * Wiktionary lists senses in its own order and mixes readings of the same
 * spelling ("wollen" as an adjective about wool and as the verb "to want"), so
 * `Lexeme.definitionEn` alone cannot answer "what does this word mean here".
 * Every sense is stored with its part of speech, tags and source order, and the
 * ranking below puts the reading the word book entry stands for first:
 *
 *   1. senses whose part of speech matches the entry's DWDS Wortart
 *   2. then senses without rare/technical tags
 *   3. then the order the dictionary listed them in
 *
 * The ranking is deliberately rule-only: no model call, and the same input
 * always produces the same order.
 */

import type { Translation } from "@/lib/i18n";
import { wordTypeFamily, type WordTypeFamily } from "@/lib/word-pos";

export type LexemeSenseSource = "wiktionary" | "odenet";

export type LexemeSense = {
  text: string;
  /** Wiktionary part of speech of the entry this sense came from. */
  partOfSpeech: string | null;
  tags: string[];
  /** Position inside its entry. */
  order: number;
  /** Position of the entry in the dictionary response. */
  entryOrder: number;
  source: LexemeSenseSource;
};

/**
 * Wiktionary tags that mark a reading as technical, dated or otherwise rare.
 * Such senses stay in the list, they only sort after the everyday ones.
 */
export const RARE_SENSE_TAGS = [
  "archaic",
  "obsolete",
  "rare",
  "dated",
  "nonstandard",
  "dialectal",
  "poetic",
  "heraldry",
  "chiefly",
  "relational",
  "literary",
  "biblical",
] as const;

/** Dictionary key used to label each part of speech in the UI. */
export const SENSE_POS_LABEL_KEYS: Record<string, keyof Translation> = {
  noun: "posNoun",
  verb: "posVerb",
  adjective: "posAdjective",
  adverb: "posAdverb",
  pronoun: "posPronoun",
  preposition: "posPreposition",
  conjunction: "posConjunction",
  numeral: "posNumeral",
  other: "posOther",
};

export function sensePosLabel(t: Translation, partOfSpeech: string | null): string | null {
  if (!partOfSpeech) {
    return null;
  }

  const key = SENSE_POS_LABEL_KEYS[partOfSpeech] ?? "posOther";

  return t[key];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readSense(value: unknown): LexemeSense | null {
  const record = asRecord(value);

  if (!record) {
    return null;
  }

  const text = typeof record.text === "string" ? record.text.trim() : "";

  if (!text) {
    return null;
  }

  const source = record.source === "odenet" ? "odenet" : "wiktionary";
  const partOfSpeech =
    typeof record.partOfSpeech === "string" && record.partOfSpeech.trim()
      ? record.partOfSpeech.trim().toLowerCase()
      : null;
  const tags = Array.isArray(record.tags)
    ? record.tags
        .filter((tag): tag is string => typeof tag === "string")
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean)
    : [];

  return {
    text,
    partOfSpeech,
    tags,
    order: Number.isFinite(record.order) ? Number(record.order) : 0,
    entryOrder: Number.isFinite(record.entryOrder)
      ? Number(record.entryOrder)
      : 0,
    source,
  };
}

/** Reads `Lexeme.sensesJson` without trusting its shape. */
export function readLexemeSenses(value: unknown): LexemeSense[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(readSense)
    .filter((sense): sense is LexemeSense => sense !== null);
}

export function isRareSense(sense: LexemeSense): boolean {
  return sense.tags.some((tag) =>
    (RARE_SENSE_TAGS as readonly string[]).includes(tag),
  );
}

function matchesEntryWordType(
  sense: LexemeSense,
  wordType: string | null,
): boolean {
  const family: WordTypeFamily | null = wordTypeFamily(wordType);

  if (!family || family === "other") {
    return false;
  }

  return family === sense.partOfSpeech;
}

/**
 * Display order: the entry's own part of speech first, rare readings last,
 * dictionary order as the stable tie-breaker. Senses are never dropped.
 */
export function rankLexemeSenses(
  senses: readonly LexemeSense[],
  wordType: string | null,
): LexemeSense[] {
  return senses
    .map((sense, index) => ({ sense, index }))
    .sort((a, b) => {
      const posA = matchesEntryWordType(a.sense, wordType) ? 0 : 1;
      const posB = matchesEntryWordType(b.sense, wordType) ? 0 : 1;
      const rareA = isRareSense(a.sense) ? 1 : 0;
      const rareB = isRareSense(b.sense) ? 1 : 0;

      return (
        posA - posB ||
        rareA - rareB ||
        a.sense.entryOrder - b.sense.entryOrder ||
        a.sense.order - b.sense.order ||
        a.index - b.index
      );
    })
    .map((entry) => entry.sense);
}

/**
 * The one-line meaning shown in the word book list: the top-ranked sense, with
 * the legacy `definitionEn` string as the fallback for entries that have not
 * been re-imported yet.
 */
export function primarySenseText(
  senses: readonly LexemeSense[],
  wordType: string | null,
  definitionEn?: string | null,
): string | null {
  const ranked = rankLexemeSenses(senses, wordType);

  if (ranked.length > 0) {
    return ranked[0].text;
  }

  const fallback = definitionEn?.split("\n")[0]?.trim();

  return fallback ? fallback : null;
}

/**
 * One row of the English meaning list, ready for rendering: the wording, the
 * reading it belongs to, where it came from and whether it is a rare reading.
 */
export type EnglishDefinitionItem = {
  text: string;
  partOfSpeech: string | null;
  rare: boolean;
};

/**
 * The English meaning list shown on the entry page and the review card: every
 * ranked dictionary sense, de-duplicated by wording. Entries imported before
 * `sensesJson` existed fall back to the stored `definitionEn`.
 *
 * OdeNet's English glosses are deliberately absent: OdeNet is a German wordnet
 * whose ILI mapping is not reliable enough to label an entry's meaning in
 * English ("sein" inherited glosses like "form or compose"). Its German
 * definitions are shown in their own block instead.
 */
export function buildEnglishDefinitions({
  senses,
  wordType,
  definitionEn,
  limit,
}: {
  senses: readonly LexemeSense[];
  wordType: string | null;
  definitionEn?: string | null;
  limit?: number;
}): EnglishDefinitionItem[] {
  const ranked = rankLexemeSenses(senses, wordType);
  const items: EnglishDefinitionItem[] = ranked.map((sense) => ({
    text: sense.text,
    partOfSpeech: sense.partOfSpeech,
    rare: isRareSense(sense),
  }));

  if (items.length === 0) {
    for (const text of definitionEn?.split("\n") ?? []) {
      const trimmed = text.trim();

      if (trimmed) {
        items.push({
          text: trimmed,
          partOfSpeech: null,
          rare: false,
        });
      }
    }
  }

  const seen = new Set<string>();
  const unique = items.filter((item) => {
    const key = item.text.toLowerCase();

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);

    return true;
  });

  return typeof limit === "number" ? unique.slice(0, limit) : unique;
}
