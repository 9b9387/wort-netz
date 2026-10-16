/**
 * Pure presentation helpers for the word detail page. Kept free of React and
 * server-only imports so they can be unit tested directly.
 */

const FREQUENCY_MAX_STARS = 6;

/**
 * DWDS frequency classes run from 1 (most frequent) to 6 (rarest). The scale is
 * inverted for the star rating shown in the entry header.
 */
export function frequencyStars(
  frequencyClass: number | null | undefined,
): number {
  if (typeof frequencyClass !== "number" || !Number.isFinite(frequencyClass)) {
    return 0;
  }

  const clamped = Math.min(
    Math.max(Math.round(frequencyClass), 1),
    FREQUENCY_MAX_STARS,
  );

  return FREQUENCY_MAX_STARS + 1 - clamped;
}

export function frequencyStarTotal(): number {
  return FREQUENCY_MAX_STARS;
}

export type WordnetRelatedWordLike = {
  lemma: string;
  partOfSpeech: string | null;
  lexemeId: string | null;
};

export type WordFormEntry = {
  word: string;
  tags: string[];
};

const NOISE_FORM_TAGS = new Set([
  "table-tags",
  "inflection-template",
  "class",
  "combined-form",
]);

/**
 * Wiktionary form lists contain template plumbing and duplicates. This keeps
 * only meaningful entries and merges rows that describe the same surface form.
 */
export function normalizeForms(
  forms: readonly WordFormEntry[],
  limit = 16,
): WordFormEntry[] {
  const merged = new Map<string, Set<string>>();

  for (const form of forms) {
    const word = form.word.trim();

    if (!word) {
      continue;
    }

    const tags = Array.from(
      new Set(form.tags.filter((tag) => !NOISE_FORM_TAGS.has(tag))),
    );
    const currentTags = merged.get(word) ?? new Set<string>();

    for (const tag of tags) {
      currentTags.add(tag);
    }

    merged.set(word, currentTags);
  }

  return Array.from(merged.entries())
    .slice(0, limit)
    .map(([word, tags]) => ({ word, tags: Array.from(tags) }));
}

export type DefinitionSource = "de" | "en" | null;

export type ResolvedDefinitions = {
  source: DefinitionSource;
  items: string[];
};

/**
 * The entry shows German definitions first. The English dictionary text is only
 * used as a fallback when no German definition exists at all.
 */
export function resolveDefinitions({
  german,
  english,
  limit = 8,
}: {
  german: readonly string[];
  english: readonly string[];
  limit?: number;
}): ResolvedDefinitions {
  const unique = (values: readonly string[]) =>
    Array.from(
      new Set(values.map((value) => value.trim()).filter(Boolean)),
    ).slice(0, limit);

  const germanItems = unique(german);

  if (germanItems.length > 0) {
    return { source: "de", items: germanItems };
  }

  const englishItems = unique(english);

  if (englishItems.length > 0) {
    return { source: "en", items: englishItems };
  }

  return { source: null, items: [] };
}
