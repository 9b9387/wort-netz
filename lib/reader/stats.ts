import { normalizeSurface } from "./tokenize";
import type { ReaderStats, ReaderToken } from "./types";

const LEVEL_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
const UNKNOWN_LEVEL = "unknown";

function levelRank(level: string): number {
  const index = LEVEL_ORDER.indexOf(level as (typeof LEVEL_ORDER)[number]);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function dedupeKey(token: ReaderToken): string {
  return token.lemma ? normalizeSurface(token.lemma) : normalizeSurface(token.text);
}

/**
 * Coverage of the article by the user's word book. Ratios are 0..1 and are
 * computed over tokens (how much of the text is understood) and over distinct
 * words (how much vocabulary is understood).
 */
export function summarizeTokens(tokens: readonly ReaderToken[]): ReaderStats {
  const uniqueKeys = new Set<string>();
  const learnedKeys = new Set<string>();
  const unlearnedKeys = new Set<string>();
  const unlearned = new Map<string, ReaderToken>();
  const unrecognizedKeys = new Set<string>();
  const functionWordKeys = new Set<string>();
  let learnedWords = 0;
  let unlearnedWords = 0;

  for (const token of tokens) {
    const key = dedupeKey(token);
    uniqueKeys.add(key);

    if (token.isFunctionWord) {
      functionWordKeys.add(key);
    }

    if (token.category === "learned") {
      learnedWords += 1;
      learnedKeys.add(key);
      continue;
    }

    if (token.category === "unlearned") {
      unlearnedWords += 1;
      unlearnedKeys.add(key);

      if (!unlearned.has(key)) {
        unlearned.set(key, token);
      }
      continue;
    }

    unrecognizedKeys.add(key);
  }

  const totalWords = tokens.length;
  const uniqueWords = uniqueKeys.size;
  /**
   * Coverage ignores unrecognized words: they are neither known nor learnable,
   * so counting them made the percentage look worse than how much of the text
   * the reader actually identifies.
   */
  const identifiableWords = learnedWords + unlearnedWords;
  const identifiableUnique = learnedKeys.size + unlearnedKeys.size;
  const levelHistogram: Record<string, number> = {};
  const knownRanks: number[] = [];

  for (const token of unlearned.values()) {
    const level = token.level && levelRank(token.level) !== Number.MAX_SAFE_INTEGER
      ? token.level
      : UNKNOWN_LEVEL;

    levelHistogram[level] = (levelHistogram[level] ?? 0) + 1;

    if (level !== UNKNOWN_LEVEL) {
      knownRanks.push(levelRank(level));
    }
  }

  knownRanks.sort((a, b) => a - b);

  const medianLevel = (ranks: readonly number[]): string | null =>
    ranks.length > 0
      ? LEVEL_ORDER[ranks[Math.floor((ranks.length - 1) / 2)]]
      : null;
  /**
   * Difficulty follows the words the user still has to learn; when none of them
   * carries a CEFR level, every word of the article is used instead, so short
   * texts do not collapse to "unknown".
   */
  const estimatedLevel =
    medianLevel(knownRanks) ?? medianLevel(collectLevelRanks(tokens));

  return {
    totalWords,
    uniqueWords,
    learnedWords,
    learnedUnique: learnedKeys.size,
    unlearnedUnique: unlearned.size,
    unrecognizedUnique: unrecognizedKeys.size,
    functionWordUnique: functionWordKeys.size,
    coverageTokenRatio:
      identifiableWords > 0 ? learnedWords / identifiableWords : 0,
    coverageUniqueRatio:
      identifiableUnique > 0 ? learnedKeys.size / identifiableUnique : 0,
    unlearnedRateRatio:
      identifiableUnique > 0 ? unlearnedKeys.size / identifiableUnique : 0,
    levelHistogram,
    estimatedLevel,
  };
}

/** CEFR ranks of every distinct word of the article that carries a level. */
function collectLevelRanks(tokens: readonly ReaderToken[]): number[] {
  const seen = new Set<string>();
  const ranks: number[] = [];

  for (const token of tokens) {
    if (!token.level) {
      continue;
    }

    const key = dedupeKey(token);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);

    const rank = levelRank(token.level);

    if (rank !== Number.MAX_SAFE_INTEGER) {
      ranks.push(rank);
    }
  }

  return ranks.sort((a, b) => a - b);
}
