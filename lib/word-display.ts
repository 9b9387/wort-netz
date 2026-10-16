/**
 * Pure presentation helpers for the word detail page. Kept free of React and
 * server-only imports so they can be unit tested directly.
 */

const FREQUENCY_MAX_STARS = 6;

/**
 * DWDS frequency classes grow with frequency: verified against the live API,
 * "und"/"ich"/"nicht" come back as 6 while rare words such as "Xylophon" come
 * back as 1. The star rating therefore follows the class directly — 6 stars is
 * a very frequent word, 1 star a rare one — so the stars and the "n/6" label
 * next to them always agree.
 *
 * A non-positive class means DWDS returned no usable value (the API answers
 * with 0 for some article forms); the caller hides the rating in that case.
 */
export function frequencyStars(
  frequencyClass: number | null | undefined,
): number {
  if (
    typeof frequencyClass !== "number" ||
    !Number.isFinite(frequencyClass) ||
    frequencyClass <= 0
  ) {
    return 0;
  }

  return Math.min(Math.max(Math.round(frequencyClass), 1), FREQUENCY_MAX_STARS);
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

export type DefinitionSets = {
  german: string[];
  english: string[];
};

function uniqueDefinitions(
  values: readonly string[],
  limit: number,
): string[] {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean)),
  ).slice(0, limit);
}

/**
 * The entry page shows the English senses (with a Chinese translation) above the
 * German ones, so both lists are returned separately instead of one replacing
 * the other.
 */
export function resolveDefinitionSets({
  german,
  english,
  limit = 8,
}: {
  german: readonly string[];
  english: readonly string[];
  limit?: number;
}): DefinitionSets {
  return {
    german: uniqueDefinitions(german, limit),
    english: uniqueDefinitions(english, limit),
  };
}

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
  const sets = resolveDefinitionSets({ german, english, limit });

  if (sets.german.length > 0) {
    return { source: "de", items: sets.german };
  }

  if (sets.english.length > 0) {
    return { source: "en", items: sets.english };
  }

  return { source: null, items: [] };
}
