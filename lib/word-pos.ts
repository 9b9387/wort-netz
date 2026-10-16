/**
 * Part-of-speech helpers shared by the dictionary pipeline and the views.
 *
 * DWDS is the only source that tells us the Wortart of an entry, and a lemma
 * like "wollen" exists as both an adjective ("wool") and a verb ("to want").
 * DWDS returns every reading as a separate snippet, so the lookup needs two
 * things this module provides: a guess about the reading the *query* belongs to
 * (morphology), and a way to compare a DWDS Wortart with a Wiktionary POS.
 */

import { irregularVerbLemma } from "@/lib/reader/verb-forms";
import { normalizeSurface } from "@/lib/reader/tokenize";

export type WordTypeFamily =
  | "noun"
  | "verb"
  | "adjective"
  | "adverb"
  | "pronoun"
  | "preposition"
  | "conjunction"
  | "numeral"
  | "other";

/** Coarse family of a DWDS Wortart, e.g. "Substantiv" -> "noun". */
export function wordTypeFamily(wordType: string | null | undefined): WordTypeFamily | null {
  if (!wordType) {
    return null;
  }

  const value = wordType.toLocaleLowerCase("de-DE");

  if (value.includes("substantiv") || value.includes("eigenname")) {
    return "noun";
  }

  if (value.includes("adjektiv") || value.includes("partizip")) {
    return "adjective";
  }

  /** Before the verb check: "adverb" contains "verb". */
  if (value.includes("adverb")) {
    return "adverb";
  }

  if (value.includes("verb")) {
    return "verb";
  }

  if (value.includes("pronomen") || value.includes("artikel")) {
    return "pronoun";
  }

  if (value.includes("präposition")) {
    return "preposition";
  }

  if (value.includes("konjunktion")) {
    return "conjunction";
  }

  if (value.includes("numerale") || value.includes("zahlwort")) {
    return "numeral";
  }

  return "other";
}

/** The part of speech string Wiktionary/FreeDictionary uses, or null. */
export function dictionaryPartOfSpeech(
  wordType: string | null | undefined,
): string | null {
  const family = wordTypeFamily(wordType);

  return family && family !== "numeral" && family !== "other" ? family : null;
}

export type PartOfSpeechHint = {
  family: WordTypeFamily;
  /**
   * `strong` comes from an unambiguous signal (a capitalized noun, the curated
   * irregular verb table); `weak` only from a verb-shaped ending.
   */
  strength: "strong" | "weak";
};

/**
 * Verb endings that are specific enough to hint at a verb reading. The single
 * letters `-e` and `-n` are deliberately absent: they would label "Lampe" and
 * "Wagen" as verbs.
 */
const VERB_FORM_SUFFIXES = [
  "test",
  "tet",
  "eten",
  "est",
  "ete",
  "ten",
  "et",
  "te",
  "en",
  "st",
  "t",
  "end",
] as const;

const MIN_VERB_STEM = 3;

function looksLikeVerbForm(normalized: string): boolean {
  return VERB_FORM_SUFFIXES.some((suffix) => {
    if (!normalized.endsWith(suffix)) {
      return false;
    }

    return normalized.length - suffix.length >= MIN_VERB_STEM;
  });
}

/**
 * Which reading a surface form most likely belongs to. German nouns are
 * capitalized, and the curated irregular verb table knows forms like
 * "willst" → "wollen" that no suffix rule could derive.
 */
export function inferSurfacePartOfSpeech(
  surface: string,
): PartOfSpeechHint | null {
  const trimmed = surface.normalize("NFC").trim();

  if (!trimmed) {
    return null;
  }

  if (/^[A-ZÄÖÜ]/u.test(trimmed)) {
    return { family: "noun", strength: "strong" };
  }

  const normalized = normalizeSurface(trimmed);

  if (irregularVerbLemma(normalized)) {
    return { family: "verb", strength: "strong" };
  }

  if (looksLikeVerbForm(normalized)) {
    return { family: "verb", strength: "weak" };
  }

  return null;
}

export type SnippetLike = {
  wortart?: string | null;
  lemma?: string;
  url?: string;
  input?: string;
};

/**
 * Penalizes proper nouns so a capitalized query such as "Lampe" stays a
 * common noun when DWDS offers both readings.
 */
function wordTypeSpecificity(wordType: string | null | undefined): number {
  return wordType === "Eigenname" ? -5 : 0;
}

/**
 * Picks the DWDS snippet that matches the queried surface form. DWDS returns
 * one snippet per Wortart and orders them independently of what the user typed,
 * which is how "willst" used to resolve to the adjective "wollen" (wool).
 *
 * Without a morphology hint the DWDS order wins, so the behaviour only changes
 * where the query itself carries a signal.
 */
export function chooseSnippetEntry<T extends SnippetLike>(
  entries: readonly T[],
  surface: string,
): T | null {
  if (entries.length === 0) {
    return null;
  }

  const hint = inferSurfacePartOfSpeech(surface);

  if (!hint) {
    return entries[0] ?? null;
  }

  let best: T | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  entries.forEach((entry, index) => {
    const family = wordTypeFamily(entry.wortart ?? null);
    let score = -index;

    if (family === hint.family) {
      score += hint.strength === "strong" ? 1000 : 100;
      score += wordTypeSpecificity(entry.wortart);
    }

    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  });

  return best ?? entries[0] ?? null;
}
