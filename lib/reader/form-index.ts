/**
 * Builds the surface-form → lemma index from an entry's Wiktionary inflection
 * table. Kept pure and separate from the database layer so the filtering rules
 * can be unit tested.
 */

/**
 * Wiktionary tables contain rows that would create wrong mappings if indexed:
 * obsolete spellings, diminutives, template plumbing and `includes-article`
 * multiword rows.
 */
export const NOISE_FORM_TAGS = new Set([
  "alternative",
  "archaic",
  "auxiliary",
  "class",
  "colloquial",
  "diminutive",
  "error-unrecognized-form",
  "includes-article",
  "inflection-template",
  "multiword-construction",
  "obsolete",
  "rare",
  "table-tags",
]);

/**
 * DWDS word types whose Wiktionary tables enumerate *other* words instead of
 * inflections of the entry: the `wir` table lists `ich`, `du`, `er`, and the
 * article tables list every case form of every article. Indexing them would
 * map unrelated surface forms onto the wrong lemma.
 */
const FUNCTION_WORD_TYPES =
  /pronomen|artikel|konjunktion|präposition|partikel|interjektion|numerale/i;

export function isFunctionWordType(
  wordType: string | null | undefined,
): boolean {
  return Boolean(wordType) && FUNCTION_WORD_TYPES.test(wordType ?? "");
}

/** Whether an entry's inflection table may be turned into surface forms. */
export function shouldIndexForms(
  wordType: string | null | undefined,
): boolean {
  return !isFunctionWordType(wordType);
}

export function extractIndexableForms(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  const rawForms = (value as { forms?: unknown }).forms;

  if (!Array.isArray(rawForms)) {
    return [];
  }

  const words: string[] = [];

  for (const entry of rawForms) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const word = (entry as { word?: unknown }).word;
    const tags = (entry as { tags?: unknown }).tags;

    if (typeof word !== "string") {
      continue;
    }

    const trimmed = word.normalize("NFC").trim();

    if (
      trimmed.length < 2 ||
      /\s/.test(trimmed) ||
      trimmed.startsWith("-") ||
      /\d/.test(trimmed)
    ) {
      continue;
    }

    if (
      Array.isArray(tags) &&
      tags.some((tag) => typeof tag === "string" && NOISE_FORM_TAGS.has(tag))
    ) {
      continue;
    }

    words.push(trimmed);
  }

  return words;
}
