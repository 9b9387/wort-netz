import { isClosedClassWord, isGermanFunctionWord } from "./stopwords";
import { normalizeSurface } from "./tokenize";

/**
 * Multi-word expression matching against the imported OdeNet phrase vocabulary.
 *
 * OdeNet stores phrases in their canonical, dictionary form ("zur Verfügung
 * stehen", "auf jeden Fall"), while an article contains inflected and often
 * split forms ("steht zur Verfügung"). Matching therefore works on windows of
 * consecutive article tokens and requires the phrase's *required* tokens — the
 * content-bearing part, i.e. the phrase minus a trailing infinitive for verb
 * phrases — to appear in the text adjacently and in order.
 */

export type PhraseRow = {
  normalizedLemma: string;
  lemma: string;
  partOfSpeech: string | null;
};

export type PhraseEntry = {
  /** Normalized dictionary form, e.g. "zur verfügung stehen". */
  normalized: string;
  /** Display form, e.g. "zur Verfügung stehen". */
  canonical: string;
  pos: string | null;
  /** Every token of the dictionary form. */
  tokens: string[];
  /** Tokens that must appear in the article, in order. */
  required: string[];
};

export type PhraseIndex = {
  /** Keyed by `${firstRequiredToken}|${requiredLength}`. */
  buckets: Map<string, PhraseEntry[]>;
};

export type PhraseToken = {
  text: string;
  normal: string;
  start: number;
  end: number;
  /** Normalized lemma candidates of this token. */
  candidates: string[];
  /** Index of the source line, used to keep a phrase inside one line block. */
  line: number;
};

/** wordfeather stores English part-of-speech labels, the matcher uses OdeNet's. */
export function wordfeatherPhrasePos(partOfSpeech: string): string | null {
  if (partOfSpeech === "noun") {
    return "n";
  }

  if (partOfSpeech === "verb") {
    return "v";
  }

  if (partOfSpeech === "adj") {
    return "a";
  }

  if (partOfSpeech === "adv") {
    return "r";
  }

  return null;
}

export type PhraseMatch = {
  phrase: PhraseEntry;
  /** Inclusive token index. */
  tokenStart: number;
  /** Exclusive token index. */
  tokenEnd: number;
  start: number;
  end: number;
};

const MIN_REQUIRED_TOKENS = 2;
const MAX_REQUIRED_TOKENS = 4;
const MAX_PHRASE_TOKENS = 5;
/** Verb phrases usually end in an infinitive that the text may place elsewhere. */
const INFINITIVE_LIKE = /(en|eln|ern|n)$/;

/**
 * Indexes the phrase vocabulary. Entries without a usable required part (single
 * words, function-word-only combinations, very long entries) are skipped so the
 * matcher stays precise.
 */
export function buildPhraseIndex(rows: readonly PhraseRow[]): PhraseIndex {
  const buckets = new Map<string, PhraseEntry[]>();
  const seen = new Set<string>();

  for (const row of rows) {
    const normalized = normalizeSurface(row.normalizedLemma);

    if (!normalized.includes(" ") || seen.has(normalized)) {
      continue;
    }

    const tokens = normalized.split(" ").filter(Boolean);

    if (tokens.length < 2 || tokens.length > MAX_PHRASE_TOKENS) {
      continue;
    }

    const lastToken = tokens[tokens.length - 1];
    const required =
      row.partOfSpeech === "v" &&
      tokens.length > MIN_REQUIRED_TOKENS &&
      INFINITIVE_LIKE.test(lastToken)
        ? tokens.slice(0, -1)
        : tokens;

    if (
      required.length < MIN_REQUIRED_TOKENS ||
      required.length > MAX_REQUIRED_TOKENS
    ) {
      continue;
    }

    // "in der" style windows must not match anything on their own, but phrases
    // built from a pronoun plus a verb ("es gibt") are kept.
    if (!required.some((token) => !isClosedClassWord(token))) {
      continue;
    }

    seen.add(normalized);

    const entry: PhraseEntry = {
      normalized,
      canonical: row.lemma.trim() || row.normalizedLemma.trim(),
      pos: row.partOfSpeech,
      tokens,
      required,
    };
    const key = `${required[0]}|${required.length}`;
    const bucket = buckets.get(key);

    if (bucket) {
      bucket.push(entry);
    } else {
      buckets.set(key, [entry]);
    }
  }

  return { buckets };
}

function tokenMatches(
  article: PhraseToken,
  required: string,
): boolean {
  if (article.normal === required) {
    return true;
  }

  // Articles, pronouns and prepositions have to match exactly: "in der Lage"
  // and "in die Lage" are different phrases.
  if (isGermanFunctionWord(required)) {
    return false;
  }

  // Content words may be inflected in the text ("Verfügungen" → "verfügung"),
  // but the phrase's word has to be a plausible lemma of the article token.
  // Intersecting both candidate sets instead would accept unfounded matches
  // through a shared stem (e.g. "es lange" → "es langt").
  return article.candidates.includes(required);
}

function matchesWindow(
  tokens: readonly PhraseToken[],
  start: number,
  entry: PhraseEntry,
): boolean {
  const length = entry.required.length;

  if (start + length > tokens.length) {
    return false;
  }

  const firstLine = tokens[start].line;

  for (let index = 0; index < length; index += 1) {
    const article = tokens[start + index];

    if (article.line !== firstLine) {
      return false;
    }

    if (!tokenMatches(article, entry.required[index])) {
      return false;
    }
  }

  return true;
}

/**
 * Several entries can share the same required part ("zur Verfügung stehen" and
 * "zur Verfügung stellen"). The word that follows the match in the article is
 * the best evidence for which one is meant, so it outranks shorter/alphabetic
 * tie-breakers.
 */
function preferred(
  current: PhraseEntry | null,
  candidate: PhraseEntry,
  tokens: readonly PhraseToken[],
  start: number,
): PhraseEntry {
  if (!current) {
    return candidate;
  }

  const continuationBonus = (entry: PhraseEntry): number => {
    const next = tokens[start + entry.required.length];
    const expected = entry.tokens[entry.required.length];

    return next && expected && tokenMatches(next, expected) ? 1 : 0;
  };
  const candidateBonus = continuationBonus(candidate);
  const currentBonus = continuationBonus(current);

  if (candidateBonus !== currentBonus) {
    return candidateBonus > currentBonus ? candidate : current;
  }

  if (candidate.required.length !== current.required.length) {
    return candidate.required.length < current.required.length
      ? candidate
      : current;
  }

  return candidate.normalized.localeCompare(current.normalized) < 0
    ? candidate
    : current;
}

/**
 * Finds non-overlapping phrases, longest window first, so `zur Verfügung` is
 * preferred over a shorter coincidental window at the same position.
 */
export function findPhrases(
  tokens: readonly PhraseToken[],
  index: PhraseIndex,
): PhraseMatch[] {
  const matches: PhraseMatch[] = [];
  const claimed = new Array<boolean>(tokens.length).fill(false);

  for (let length = MAX_REQUIRED_TOKENS; length >= MIN_REQUIRED_TOKENS; length -= 1) {
    for (let start = 0; start + length <= tokens.length; start += 1) {
      let alreadyClaimed = false;

      for (let index = start; index < start + length; index += 1) {
        if (claimed[index]) {
          alreadyClaimed = true;
          break;
        }
      }

      if (alreadyClaimed) {
        continue;
      }

      let best: PhraseEntry | null = null;

      for (const lemma of tokens[start].candidates) {
        const bucket = index.buckets.get(`${lemma}|${length}`);

        if (!bucket) {
          continue;
        }

        for (const entry of bucket) {
          if (matchesWindow(tokens, start, entry)) {
            best = preferred(best, entry, tokens, start);
          }
        }
      }

      if (!best) {
        continue;
      }

      for (let index = start; index < start + length; index += 1) {
        claimed[index] = true;
      }

      matches.push({
        phrase: best,
        tokenStart: start,
        tokenEnd: start + length,
        start: tokens[start].start,
        end: tokens[start + length - 1].end,
      });
    }
  }

  return matches.sort((a, b) => a.start - b.start);
}

/**
 * Maps every token that lies inside a phrase to that phrase — not just the first
 * token, which is what a `Map` keyed on `phrase.start` would give you. The
 * renderer uses this to give the whole expression one click target and one style.
 */
export function mapPhrasesToTokens<
  Token extends { start: number; end: number },
  Phrase extends { start: number; end: number },
>(
  tokens: readonly Token[],
  phrases: readonly Phrase[],
): Map<Token, Phrase> {
  const result = new Map<Token, Phrase>();

  if (phrases.length === 0) {
    return result;
  }

  const sorted = [...phrases].sort((a, b) => a.start - b.start);
  let index = 0;

  for (const token of tokens) {
    while (index < sorted.length && sorted[index].end <= token.start) {
      index += 1;
    }

    const phrase = sorted[index];

    if (phrase && token.start >= phrase.start && token.end <= phrase.end) {
      result.set(token, phrase);
    }
  }

  return result;
}
