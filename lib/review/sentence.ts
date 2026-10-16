/**
 * Picking and validating the example sentence a review card shows.
 *
 * The card is only useful when the target word is actually in the sentence, so
 * candidates that cannot be highlighted are dropped here. Tatoeba ranks Chinese
 * translated, short sentences first; this module keeps that order, only adding
 * the source preference (Tatoeba before OdeNet before an AI sentence) and a
 * rotation so a word does not show the same sentence every time.
 */

import { IRREGULAR_VERBS } from "@/lib/reader/verb-forms";
import { normalizeSurface } from "@/lib/reader/tokenize";
import {
  findHighlightRanges,
  type HighlightRange,
  type HighlightTarget,
} from "./highlight";

export type ReviewSentenceSource = "tatoeba" | "odenet" | "ai";

export type ReviewSentenceCandidate = {
  text: string;
  translation: string | null;
  source: ReviewSentenceSource;
  sourceUrl: string | null;
  license: string | null;
};

export type ResolvedReviewSentence = {
  text: string;
  highlightRanges: HighlightRange[];
  translation: string | null;
  source: ReviewSentenceSource;
  sourceUrl: string | null;
  license: string | null;
  generated: boolean;
};

/** Sentence window shared with the Tatoeba parser guards. */
export const MIN_REVIEW_WORDS = 4;
export const MAX_REVIEW_WORDS = 16;
export const MAX_REVIEW_CHARS = 160;

const SOURCE_RANK: Record<ReviewSentenceSource, number> = {
  tatoeba: 0,
  odenet: 1,
  ai: 2,
};

const VERB_FORMS_BY_INFINITIVE = new Map<string, string[]>();

for (const verb of IRREGULAR_VERBS) {
  const infinitive = normalizeSurface(verb.infinitive);
  const forms = VERB_FORMS_BY_INFINITIVE.get(infinitive) ?? [];

  forms.push(...verb.forms.map(normalizeSurface).filter(Boolean));
  VERB_FORMS_BY_INFINITIVE.set(infinitive, forms);
}

/** Curated irregular verb forms of a lemma, used to widen the sentence search. */
export function irregularVerbForms(lemma: string): string[] {
  return VERB_FORMS_BY_INFINITIVE.get(normalizeSurface(lemma)) ?? [];
}

/**
 * Highlight and search target for an entry. A multi-word entry ("Zur Verfügung
 * stehen") is matched as a whole, everything else through its lemma and forms.
 */
export function buildHighlightTarget({
  lemma,
  forms = [],
  extraForms = [],
}: {
  lemma: string;
  forms?: readonly string[];
  extraForms?: readonly string[];
}): HighlightTarget & { searchForms: string[] } {
  const trimmed = lemma.trim();
  const isPhrase = /\s/u.test(trimmed);
  const searchForms = Array.from(
    new Set(
      [...forms, ...extraForms, ...irregularVerbForms(trimmed)]
        .map((form) => form.trim())
        .filter((form) => form && normalizeSurface(form) !== normalizeSurface(trimmed)),
    ),
  );

  return {
    lemma: trimmed,
    phrase: isPhrase ? trimmed : null,
    forms: searchForms,
    searchForms,
  };
}

export function reviewWordCount(text: string): number {
  return text.split(/\s+/u).filter(Boolean).length;
}

function normalizedText(text: string): string {
  return text.normalize("NFC").trim().replace(/\s+/gu, " ").toLowerCase();
}

/**
 * The best sentence for one card, or null when nothing contains the word.
 * `rotation` is the answer count, so repeated reviews walk through the
 * candidates instead of showing the same sentence forever.
 */
export function selectReviewSentence({
  candidates,
  target,
  rotation = 0,
}: {
  candidates: readonly ReviewSentenceCandidate[];
  target: HighlightTarget;
  rotation?: number;
}): ResolvedReviewSentence | null {
  const seen = new Set<string>();
  const usable: Array<{
    candidate: ReviewSentenceCandidate;
    ranges: HighlightRange[];
  }> = [];

  candidates.forEach((candidate) => {
    const text = candidate.text.trim();
    const key = normalizedText(text);

    if (!text || seen.has(key)) {
      return;
    }

    seen.add(key);

    const ranges = findHighlightRanges(text, target);

    if (ranges.length === 0) {
      return;
    }

    usable.push({
      candidate: {
        ...candidate,
        text,
        translation: candidate.translation?.trim() || null,
        sourceUrl: candidate.sourceUrl ?? null,
      },
      ranges,
    });
  });

  if (usable.length === 0) {
    return null;
  }

  const ranked = usable
    .map((entry, index) => ({ ...entry, index }))
    .sort(
      (a, b) =>
        SOURCE_RANK[a.candidate.source] - SOURCE_RANK[b.candidate.source] ||
        Number(Boolean(b.candidate.translation)) -
          Number(Boolean(a.candidate.translation)) ||
        reviewWordCount(a.candidate.text) - reviewWordCount(b.candidate.text) ||
        a.index - b.index,
    );
  const picked = ranked[Math.abs(Math.trunc(rotation)) % ranked.length];

  return {
    text: picked.candidate.text,
    highlightRanges: picked.ranges,
    translation: picked.candidate.translation,
    source: picked.candidate.source,
    sourceUrl: picked.candidate.sourceUrl,
    license: picked.candidate.license,
    generated: picked.candidate.source === "ai",
  };
}

/** The substring a highlight covers, stored with cached AI sentences. */
export function highlightText(
  text: string,
  ranges: readonly HighlightRange[],
): string {
  const first = ranges[0];

  return first ? text.slice(first.start, first.end) : "";
}

/**
 * Reads the strict JSON an LLM is asked for. Tolerates a fenced code block and
 * surrounding prose, because models add both even when told not to.
 */
export function parseGeneratedSentence(
  raw: string,
): { sentence: string; translation: string } | null {
  const withoutFence = raw
    .replace(/```(?:json)?/giu, "")
    .replace(/```/gu, "")
    .trim();
  const start = withoutFence.indexOf("{");
  const end = withoutFence.lastIndexOf("}");

  if (start === -1 || end <= start) {
    return null;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(withoutFence.slice(start, end + 1));
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }

  const record = parsed as Record<string, unknown>;
  const sentence =
    typeof record.sentence === "string" ? record.sentence.trim() : "";
  const translation =
    typeof record.translation === "string" ? record.translation.trim() : "";

  if (!sentence || !translation) {
    return null;
  }

  return { sentence, translation };
}

/**
 * Guards an AI sentence before it is cached: learner-sized, actually contains
 * the word, and carries a translation.
 */
export function validateGeneratedSentence({
  sentence,
  translation,
  target,
}: {
  sentence: string;
  translation: string;
  target: HighlightTarget;
}): boolean {
  const text = sentence.trim();

  if (!text || !translation.trim()) {
    return false;
  }

  if (text.length > MAX_REVIEW_CHARS) {
    return false;
  }

  const words = reviewWordCount(text);

  if (words < MIN_REVIEW_WORDS || words > MAX_REVIEW_WORDS) {
    return false;
  }

  return findHighlightRanges(text, target).length > 0;
}
