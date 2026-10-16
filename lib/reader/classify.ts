import {
  candidateLemmas,
  compoundSplits,
  type Candidate,
} from "./candidates";
import { isGermanFunctionWord, isPossessiveForm } from "./stopwords";
import { normalizeSurface } from "./tokenize";
import type { ReaderCategory, ReaderMatch } from "./types";
import { irregularVerbLemma } from "./verb-forms";

export type UserWordFact = {
  lexemeId: string;
  /** Canonical lemma as stored on the lexeme. */
  lemma: string;
  isFavorite: boolean;
  dueAt: string | null;
  status: string;
};

export type GlobalWordFact = {
  lexemeId: string | null;
  lemma: string;
  pos: string | null;
  level: string | null;
  /**
   * OdeNet marks basic vocabulary. A rule-derived candidate (gone → gon) only
   * counts against such entries: otherwise an obscure entry makes the reader
   * claim a word it can never open.
   */
  basic: boolean;
};

export type ReaderLexicon = {
  /** Normalized lemma *or* known inflected form mapped to the user's word. */
  userForms: Map<string, UserWordFact>;
  /** Normalized lemma mapped to the global dictionary entry, when it exists. */
  globalLemmas: Map<string, GlobalWordFact>;
};

export type Classification = {
  category: ReaderCategory;
  lemma: string | null;
  lexemeId: string | null;
  match: ReaderMatch;
  pos: string | null;
  level: string | null;
  isFunctionWord: boolean;
  inWordBook: boolean;
  isFavorite: boolean;
  dueAt: string | null;
};

export function emptyLexicon(): ReaderLexicon {
  return {
    userForms: new Map(),
    globalLemmas: new Map(),
  };
}

function matchFor(
  candidate: Candidate,
  normalizedSurfaceValue: string,
  lemma: string,
): ReaderMatch {
  if (normalizeSurface(lemma) === normalizedSurfaceValue) {
    return "exact";
  }

  if (candidate.kind === "suffix" || candidate.kind === "participle") {
    return "rule";
  }

  return "form";
}

function learned(
  fact: UserWordFact,
  globals: GlobalWordFact | undefined,
  match: ReaderMatch,
  isFunctionWord: boolean,
): Classification {
  return {
    category: "learned",
    lemma: fact.lemma,
    lexemeId: fact.lexemeId,
    match,
    pos: globals?.pos ?? null,
    level: globals?.level ?? null,
    isFunctionWord,
    inWordBook: true,
    isFavorite: fact.isFavorite,
    dueAt: fact.dueAt,
  };
}

function unlearned(
  fact: GlobalWordFact,
  match: ReaderMatch,
  isFunctionWord: boolean,
): Classification {
  return {
    category: "unlearned",
    lemma: fact.lemma,
    lexemeId: fact.lexemeId,
    match,
    pos: fact.pos,
    level: fact.level,
    isFunctionWord,
    inWordBook: false,
    isFavorite: false,
    dueAt: null,
  };
}

/** Entries a guessed (rule-derived) lemma may resolve to. */
function isOpenableByRule(fact: GlobalWordFact): boolean {
  return fact.basic || Boolean(fact.level) || Boolean(fact.lexemeId);
}

function unrecognized(
  normalizedSurfaceValue: string,
  isFunctionWord: boolean,
): Classification {
  return {
    category: "unrecognized",
    lemma: null,
    lexemeId: null,
    match: "none",
    pos: null,
    level: null,
    isFunctionWord,
    inWordBook: false,
    isFavorite: false,
    dueAt: null,
  };
}

type PartResolution = {
  user?: UserWordFact;
  global?: GlobalWordFact;
  candidate: Candidate;
  normalized: string;
};

function resolvePart(
  part: string,
  lexicon: ReaderLexicon,
  candidates: Candidate[],
): PartResolution | null {
  for (const candidate of candidates) {
    const user = lexicon.userForms.get(candidate.lemma);

    if (user) {
      return { user, global: lexicon.globalLemmas.get(candidate.lemma), candidate, normalized: part };
    }

    const global = lexicon.globalLemmas.get(candidate.lemma);

    if (global) {
      return { global, candidate, normalized: part };
    }
  }

  return null;
}

/**
 * Resolves one word of the article against the user's word book first and the
 * global dictionary second. Everything stays deterministic: rule candidates are
 * already sorted by plausibility, and the user's entries always win over the
 * global ones.
 */
export function classifySurface(
  surface: string,
  lexicon: ReaderLexicon,
): Classification {
  const normalized = normalizeSurface(surface);
  const isFunctionWord = isGermanFunctionWord(normalized);
  const possessive = isPossessiveForm(normalized);
  /**
   * Possessives only match their own dictionary entry: a rule-derived lemma
   * would file "seine" under the verb "sein".
   */
  const candidates = possessive
    ? candidateLemmas(surface).filter((candidate) => candidate.kind === "exact")
    : candidateLemmas(surface);

  for (const candidate of candidates) {
    const user = lexicon.userForms.get(candidate.lemma);

    if (user) {
      return learned(
        user,
        lexicon.globalLemmas.get(candidate.lemma),
        matchFor(candidate, normalized, user.lemma),
        isFunctionWord,
      );
    }
  }

  /**
   * Curated irregular verb forms come before the generic dictionary lookup:
   * otherwise OdeNet's noun entry for "waren" wins over the past tense of
   * "sein". The user's own word book has already been consulted above.
   */
  const verbLemma = irregularVerbLemma(normalized);

  if (verbLemma) {
    const user = lexicon.userForms.get(verbLemma);

    if (user) {
      return learned(
        user,
        lexicon.globalLemmas.get(verbLemma),
        "form",
        isFunctionWord,
      );
    }

    const global = lexicon.globalLemmas.get(verbLemma);

    if (global) {
      return unlearned(global, "form", isFunctionWord);
    }
  }

  for (const candidate of candidates) {
    const global = lexicon.globalLemmas.get(candidate.lemma);

    if (!global) {
      continue;
    }

    // The exact form is always trusted; guessed forms only when the entry is a
    // word the reader could actually open and learn.
    if (candidate.kind !== "exact" && !isOpenableByRule(global)) {
      continue;
    }

    return unlearned(
      global,
      matchFor(candidate, normalized, global.lemma),
      isFunctionWord,
    );
  }

  for (const split of compoundSplits(surface)) {
    // A real German compound is built from two words the reader could look up.
    // Without that check a surname such as "Tillmanns" gets split into
    // "till" + "manns" and filed under "Mann".
    const modifier = resolvePart(
      split.modifier,
      lexicon,
      candidateLemmas(split.modifier),
    );
    const head = resolvePart(split.head, lexicon, candidateLemmas(split.head));

    if (!head || !modifier) {
      continue;
    }

    const headOpenable = head.global
      ? isOpenableByRule(head.global)
      : Boolean(head.user);
    const modifierOpenable = modifier.global
      ? isOpenableByRule(modifier.global)
      : Boolean(modifier.user);

    if (!headOpenable || !modifierOpenable) {
      continue;
    }

    if (head.user) {
      return learned(head.user, head.global, "rule", isFunctionWord);
    }

    if (head.global) {
      return unlearned(head.global, "rule", isFunctionWord);
    }
  }

  return unrecognized(normalized, isFunctionWord);
}
