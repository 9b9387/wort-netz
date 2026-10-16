import { normalizeSurface } from "./tokenize";

export type CandidateKind = "exact" | "suffix" | "participle" | "compound";

export type Candidate = {
  /** Normalized (lowercase) lemma candidate. */
  lemma: string;
  kind: CandidateKind;
  /** Lower weights are more plausible; used for deterministic tie-breaking. */
  weight: number;
  /** Set for compound candidates: every part that resolved to a candidate. */
  parts?: string[];
};

const MAX_CANDIDATES = 16;

const VERB_SUFFIXES = new Set([
  "t",
  "e",
  "n",
  "en",
  "st",
  "et",
  "est",
  "te",
  "ten",
  "tet",
  "test",
  "ete",
  "eten",
  "end",
]);

type SuffixRule = { suffix: string; weight: number; minStem: number };

/**
 * Ordered from "closest to the surface form" to "more speculative". The
 * weights feed the deterministic ordering in `candidateLemmas`, so a rule that
 * strips less always wins as the reported lemma.
 */
const SUFFIX_RULES: SuffixRule[] = [
  { suffix: "test", weight: 29, minStem: 3 },
  { suffix: "tet", weight: 29, minStem: 3 },
  { suffix: "eten", weight: 29, minStem: 3 },
  { suffix: "est", weight: 28, minStem: 3 },
  { suffix: "ete", weight: 28, minStem: 3 },
  { suffix: "ten", weight: 27, minStem: 3 },
  { suffix: "et", weight: 26, minStem: 3 },
  { suffix: "te", weight: 26, minStem: 3 },
  { suffix: "en", weight: 25, minStem: 3 },
  { suffix: "st", weight: 24, minStem: 3 },
  { suffix: "end", weight: 24, minStem: 3 },
  { suffix: "t", weight: 22, minStem: 3 },
  { suffix: "e", weight: 20, minStem: 3 },
  { suffix: "n", weight: 20, minStem: 3 },
  { suffix: "ern", weight: 18, minStem: 3 },
  { suffix: "ers", weight: 18, minStem: 3 },
  { suffix: "ens", weight: 18, minStem: 3 },
  { suffix: "em", weight: 17, minStem: 3 },
  { suffix: "er", weight: 17, minStem: 3 },
  { suffix: "es", weight: 17, minStem: 3 },
  { suffix: "ns", weight: 16, minStem: 3 },
  { suffix: "s", weight: 15, minStem: 4 },
  { suffix: "sten", weight: 14, minStem: 3 },
  { suffix: "ster", weight: 14, minStem: 3 },
  { suffix: "ste", weight: 14, minStem: 3 },
  { suffix: "eren", weight: 13, minStem: 3 },
  { suffix: "erer", weight: 13, minStem: 3 },
  { suffix: "ere", weight: 13, minStem: 3 },
  { suffix: "ungen", weight: 8, minStem: 4 },
  { suffix: "keiten", weight: 8, minStem: 4 },
  { suffix: "heiten", weight: 8, minStem: 4 },
  { suffix: "ung", weight: 8, minStem: 4 },
  { suffix: "keit", weight: 8, minStem: 4 },
  { suffix: "heit", weight: 8, minStem: 4 },
  { suffix: "lichsten", weight: 6, minStem: 4 },
  { suffix: "lich", weight: 6, minStem: 4 },
];

const MIN_PART_LENGTH = 3;
const MAX_COMPOUND_SPLITS = 8;

export function foldUmlauts(value: string): string {
  return value
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u");
}

export function foldSharpS(value: string): string {
  return value.replace(/ß/g, "ss");
}

function addCandidate(
  target: Map<string, Candidate>,
  lemma: string,
  kind: CandidateKind,
  weight: number,
  parts?: string[],
) {
  const normalized = normalizeSurface(lemma);

  if (normalized.length < MIN_PART_LENGTH - 1) {
    return;
  }

  const existing = target.get(normalized);

  if (existing && existing.weight <= weight) {
    return;
  }

  target.set(normalized, { lemma: normalized, kind, weight, parts });
}

function addDerivedForms(
  target: Map<string, Candidate>,
  stem: string,
  weight: number,
) {
  addCandidate(target, stem, "suffix", weight);
  addCandidate(target, foldUmlauts(stem), "suffix", weight + 1);
  addCandidate(target, foldSharpS(stem), "suffix", weight + 1);

  // Infinitives end in -en: `spiel` → `spielen`, `wander` → `wandern`. Stems
  // that already end in -e (`Katze`) would only produce noise like `katzeen`.
  if (!/e$/.test(stem)) {
    addCandidate(target, `${stem}en`, "suffix", weight + 2);
    addCandidate(target, `${foldUmlauts(stem)}en`, "suffix", weight + 3);
  }
}

/**
 * Rule-based lemma candidates for a German surface form. High recall for
 * regular inflection; irregular verb stems (`ging`, `gegangen`, `bat`) are only
 * resolved when the entry's `forms_json` or the user's encountered surface
 * forms already contain them — those are indexed by the server layer.
 */
export function candidateLemmas(surface: string): Candidate[] {
  const normalized = normalizeSurface(surface);
  const target = new Map<string, Candidate>();

  addCandidate(target, normalized, "exact", 0);
  addCandidate(target, foldUmlauts(normalized), "exact", 1);
  addCandidate(target, foldSharpS(normalized), "exact", 1);

  for (const rule of SUFFIX_RULES) {
    if (!normalized.endsWith(rule.suffix)) {
      continue;
    }

    const stem = normalized.slice(0, normalized.length - rule.suffix.length);

    if (stem.length < rule.minStem) {
      continue;
    }

    if (VERB_SUFFIXES.has(rule.suffix)) {
      addDerivedForms(target, stem, rule.weight);
    } else {
      addCandidate(target, stem, "suffix", rule.weight);
      addCandidate(target, foldUmlauts(stem), "suffix", rule.weight + 1);
    }
  }

  if (normalized.length > 5 && normalized.startsWith("ge")) {
    const stem = normalized.slice(2);
    addCandidate(target, stem, "participle", 25);
    addCandidate(target, foldUmlauts(stem), "participle", 26);
    addCandidate(target, `${stem}en`, "participle", 27);

    for (const rule of SUFFIX_RULES) {
      if (!stem.endsWith(rule.suffix)) {
        continue;
      }

      const inner = stem.slice(0, stem.length - rule.suffix.length);

      if (inner.length < rule.minStem) {
        continue;
      }

      addCandidate(target, inner, "participle", 34);
      addCandidate(target, `${inner}en`, "participle", 35);
      addCandidate(target, foldUmlauts(inner), "participle", 36);
    }
  }

  if (normalized.length > 4 && normalized.startsWith("zu")) {
    addCandidate(target, normalized.slice(2), "participle", 30);
  }

  return Array.from(target.values())
    .sort((a, b) => a.weight - b.weight || b.lemma.length - a.lemma.length)
    .slice(0, MAX_CANDIDATES);
}

export type CompoundSplit = { modifier: string; head: string };

/**
 * Splits a long German compound into a modifier and a head so each side can be
 * looked up separately. Bounded to keep the candidate count small.
 */
export function compoundSplits(surface: string): CompoundSplit[] {
  const normalized = normalizeSurface(surface);
  const splits: CompoundSplit[] = [];

  if (normalized.length < MIN_PART_LENGTH * 2) {
    return splits;
  }

  for (
    let index = MIN_PART_LENGTH;
    index <= normalized.length - MIN_PART_LENGTH;
    index += 1
  ) {
    splits.push({
      modifier: normalized.slice(0, index),
      head: normalized.slice(index),
    });
  }

  return splits.slice(0, MAX_COMPOUND_SPLITS);
}

/**
 * Whether `lemma` is one of the plausible lemmas of `surface` itself. Used to
 * vet the lemma an annotation hands to the dictionary lookup: a compound
 * fallback may have guessed a head word ("Tillmanns" → "mann") that the surface
 * never actually suggests.
 */
export function isCandidateLemma(surface: string, lemma: string): boolean {
  const normalized = normalizeSurface(lemma);

  return candidateLemmas(surface).some(
    (candidate) => candidate.lemma === normalized,
  );
}
