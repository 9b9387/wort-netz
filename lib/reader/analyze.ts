import "server-only";

import { prisma } from "@/lib/prisma";
import { candidateLemmas, compoundSplits } from "@/lib/reader/candidates";
import {
  classifySurface,
  type GlobalWordFact,
  type ReaderLexicon,
  type UserWordFact,
} from "@/lib/reader/classify";
import { extractIndexableForms, shouldIndexForms } from "@/lib/reader/form-index";
import {
  buildPhraseIndex,
  findPhrases,
  wordfeatherPhrasePos,
  type PhraseIndex,
  type PhraseRow,
  type PhraseToken,
} from "@/lib/reader/phrases";
import { SUPPLEMENTAL_PHRASES } from "@/lib/reader/phrase-supplement";
import { irregularVerbLemma } from "@/lib/reader/verb-forms";
import { summarizeTokens } from "@/lib/reader/stats";
import { normalizeSurface, tokenizeWords } from "@/lib/reader/tokenize";
import {
  READER_MAX_CHARS,
  type ReaderAnalysis,
  type ReaderPhrase,
  type ReaderToken,
} from "@/lib/reader/types";

const IN_CHUNK_SIZE = 500;
const USER_INDEX_TTL_MS = 60_000;
const MAX_USER_LEXEMES_FOR_FORM_INDEX = 3_000;
const MAX_DIRECT_CANDIDATES = 4_000;
const MAX_COMPOUND_CANDIDATES = 8_000;
const PHRASE_INDEX_TTL_MS = 10 * 60 * 1000;

const LEVEL_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"];

type OdeNetEntry = {
  normalizedLemma: string;
  lemma: string;
  partOfSpeech: string | null;
  basicVocabulary: boolean;
};

function odenetEntryScore(entry: OdeNetEntry): number {
  const spellingMatchesLemma =
    entry.lemma.toLowerCase() === entry.normalizedLemma ? 2 : 0;

  return spellingMatchesLemma + (entry.basicVocabulary ? 1 : 0);
}

type CachedUserIndex = {
  builtAt: number;
  forms: Map<string, UserWordFact>;
};

const userIndexCache = new Map<string, CachedUserIndex>();

/**
 * Drops the cached word book of one user. Called whenever a word or phrase is
 * collected, so the next analysis reflects the click instead of waiting for the
 * cache to expire.
 */
export function invalidateUserFormIndex(userId: string): void {
  userIndexCache.delete(userId);
}

let phraseIndexCache: { builtAt: number; index: PhraseIndex } | null = null;

/**
 * The OdeNet phrase vocabulary changes only when it is re-imported, so it is
 * loaded once per process and reused.
 */
async function getPhraseIndex(): Promise<PhraseIndex> {
  if (
    phraseIndexCache &&
    Date.now() - phraseIndexCache.builtAt < PHRASE_INDEX_TTL_MS
  ) {
    return phraseIndexCache.index;
  }

  // OdeNet covers dictionary-style phrases, wordfeather adds A1–C2 multi-word
  // entries ("Bis bald"), and the curated list fills the everyday gaps.
  const [odenetRows, wordfeatherRows] = await Promise.all([
    prisma.wordnetLexicalEntry.findMany({
      where: { normalizedLemma: { contains: " " } },
      select: { normalizedLemma: true, lemma: true, partOfSpeech: true },
    }),
    prisma.vocabularyLevel.findMany({
      where: { normalizedLemma: { contains: " " } },
      select: { normalizedLemma: true, lemma: true, partOfSpeech: true },
    }),
  ]);
  const rows: PhraseRow[] = [
    ...odenetRows,
    ...wordfeatherRows.map((row) => ({
      normalizedLemma: row.normalizedLemma,
      lemma: row.lemma,
      partOfSpeech: wordfeatherPhrasePos(row.partOfSpeech),
    })),
    ...SUPPLEMENTAL_PHRASES.map((entry) => ({
      normalizedLemma: entry.phrase,
      lemma: entry.phrase,
      partOfSpeech: entry.pos ?? "r",
    })),
  ];
  const index = buildPhraseIndex(rows);

  phraseIndexCache = { builtAt: Date.now(), index };
  return index;
}

function levelRank(level: string): number {
  const index = LEVEL_ORDER.indexOf(level);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function chunks<T>(values: readonly T[], size: number): T[][] {
  const result: T[][] = [];

  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }

  return result;
}

async function buildUserFormIndex(
  userId: string,
): Promise<Map<string, UserWordFact>> {
  const cached = userIndexCache.get(userId);

  if (cached && Date.now() - cached.builtAt < USER_INDEX_TTL_MS) {
    return cached.forms;
  }

  const [rows, encounters] = await Promise.all([
    prisma.userLexeme.findMany({
      where: { userId },
      take: MAX_USER_LEXEMES_FOR_FORM_INDEX,
      orderBy: { lastSeenAt: "desc" },
      select: {
        lexemeId: true,
        isFavorite: true,
        dueAt: true,
        status: true,
        lexeme: {
          select: {
            canonicalLemma: true,
            normalizedLemma: true,
            wordType: true,
            formsJson: true,
          },
        },
      },
    }),
    prisma.encounter.findMany({
      where: { userId },
      select: { surfaceForm: true, lexemeId: true },
      distinct: ["surfaceForm", "lexemeId"],
      take: MAX_USER_LEXEMES_FOR_FORM_INDEX * 4,
    }),
  ]);

  const forms = new Map<string, UserWordFact>();
  const byLexemeId = new Map<string, UserWordFact>();

  for (const row of rows) {
    const fact: UserWordFact = {
      lexemeId: row.lexemeId,
      lemma: row.lexeme.canonicalLemma,
      isFavorite: row.isFavorite,
      dueAt: row.dueAt ? row.dueAt.toISOString() : null,
      status: row.status,
    };

    forms.set(row.lexeme.normalizedLemma, fact);
    byLexemeId.set(row.lexemeId, fact);

    if (!shouldIndexForms(row.lexeme.wordType)) {
      continue;
    }

    for (const word of extractIndexableForms(row.lexeme.formsJson)) {
      const key = normalizeSurface(word);

      if (!forms.has(key)) {
        forms.set(key, fact);
      }
    }
  }

  for (const encounter of encounters) {
    const key = normalizeSurface(encounter.surfaceForm);
    const fact = forms.get(key) ?? byLexemeId.get(encounter.lexemeId);

    if (!fact || forms.has(key)) {
      continue;
    }

    forms.set(key, fact);
  }

  userIndexCache.set(userId, { builtAt: Date.now(), forms });
  return forms;
}

async function buildGlobalIndex(
  candidates: readonly string[],
): Promise<Map<string, GlobalWordFact>> {
  const index = new Map<string, GlobalWordFact>();

  if (candidates.length === 0) {
    return index;
  }

  // Every chunk is queried in a single parallel wave so a long article does not
  // serialize one round trip per chunk.
  const chunksOfCandidates = chunks(candidates, IN_CHUNK_SIZE);
  const [lexemeResults, entryResults, levelResults] = await Promise.all([
    Promise.all(
      chunksOfCandidates.map((chunk) =>
        prisma.lexeme.findMany({
          where: { normalizedLemma: { in: chunk } },
          select: {
            id: true,
            canonicalLemma: true,
            normalizedLemma: true,
            wordType: true,
            vocabularyLevels: { select: { level: true } },
          },
        }),
      ),
    ),
    Promise.all(
      chunksOfCandidates.map((chunk) =>
        prisma.wordnetLexicalEntry.findMany({
          where: { normalizedLemma: { in: chunk } },
          select: {
            normalizedLemma: true,
            lemma: true,
            partOfSpeech: true,
            basicVocabulary: true,
          },
        }),
      ),
    ),
    Promise.all(
      chunksOfCandidates.map((chunk) =>
        prisma.vocabularyLevel.findMany({
          where: { normalizedLemma: { in: chunk } },
          select: { normalizedLemma: true, level: true },
        }),
      ),
    ),
  ]);

  /**
   * OdeNet holds several entries per lemma, including nominalizations
   * ("das Kommen", "das Haben"). Pick the most word-like one — the spelling
   * that matches the normalized lemma and, failing that, basic vocabulary —
   * so "kam" is not displayed as the noun "Kommen".
   */
  const bestEntries = new Map<string, OdeNetEntry>();

  for (const entries of entryResults) {
    for (const entry of entries) {
      const current = bestEntries.get(entry.normalizedLemma);

      if (!current || odenetEntryScore(entry) > odenetEntryScore(current)) {
        bestEntries.set(entry.normalizedLemma, entry);
      }
    }
  }

  for (const [normalized, entry] of bestEntries) {
    index.set(normalized, {
      lexemeId: null,
      lemma: entry.lemma,
      pos: entry.partOfSpeech,
      level: null,
      basic: entry.basicVocabulary,
    });
  }

  for (const levels of levelResults) {
    for (const level of levels) {
      const current = index.get(level.normalizedLemma);

      if (!current) {
        index.set(level.normalizedLemma, {
          lexemeId: null,
          lemma: level.normalizedLemma,
          pos: null,
          level: level.level,
          basic: true,
        });
        continue;
      }

      if (!current.level || levelRank(level.level) < levelRank(current.level)) {
        index.set(level.normalizedLemma, { ...current, level: level.level });
      }
    }
  }

  for (const lexemes of lexemeResults) {
    for (const lexeme of lexemes) {
      const current = index.get(lexeme.normalizedLemma);
      const level = (lexeme.vocabularyLevels ?? [])
        .map((item) => item.level)
        .sort((a, b) => levelRank(a) - levelRank(b))[0];

      index.set(lexeme.normalizedLemma, {
        lexemeId: lexeme.id,
        lemma: lexeme.canonicalLemma,
        pos: lexeme.wordType ?? current?.pos ?? null,
        level: level ?? current?.level ?? null,
        basic: true,
      });
    }
  }

  return index;
}

function collectCandidates(surfaces: readonly string[]): string[] {
  const direct = new Set<string>();

  for (const surface of surfaces) {
    for (const candidate of candidateLemmas(surface)) {
      direct.add(candidate.lemma);
    }

    // Irregular forms cannot be derived by the suffix rules, so the infinite
    // they belong to has to be queried explicitly — otherwise "kam" never sees
    // the dictionary entry for "kommen".
    const verbLemma = irregularVerbLemma(surface);

    if (verbLemma) {
      direct.add(verbLemma);
    }
  }

  if (direct.size > MAX_DIRECT_CANDIDATES) {
    return Array.from(direct);
  }

  const compound = new Set<string>();

  for (const surface of surfaces) {
    if (surface.length < 8) {
      continue;
    }

    for (const split of compoundSplits(surface)) {
      compound.add(split.head);

      for (const candidate of candidateLemmas(split.head)) {
        compound.add(candidate.lemma);
      }
    }

    if (compound.size > MAX_COMPOUND_CANDIDATES) {
      break;
    }
  }

  return Array.from(new Set([...direct, ...compound]));
}

export class ReaderTextTooLongError extends Error {
  constructor() {
    super(`Reader text exceeds ${READER_MAX_CHARS} characters`);
    this.name = "ReaderTextTooLongError";
  }
}

/**
 * Matches multi-word expressions and resolves whether the user already has them
 * in the word book.
 */
async function resolvePhrases({
  userId,
  text,
  rawTokens,
  phraseIndex,
}: {
  userId: string;
  text: string;
  rawTokens: readonly { text: string; start: number; end: number }[];
  phraseIndex: PhraseIndex | null;
}): Promise<ReaderPhrase[]> {
  if (rawTokens.length < 2 || !phraseIndex) {
    return [];
  }

  const phraseTokens: PhraseToken[] = [];
  let line = 0;
  let cursor = 0;

  for (const token of rawTokens) {
    for (let index = cursor; index < token.start; index += 1) {
      if (text[index] === "\n") {
        line += 1;
      }
    }

    cursor = token.start;
    phraseTokens.push({
      text: token.text,
      normal: normalizeSurface(token.text),
      start: token.start,
      end: token.end,
      candidates: candidateLemmas(token.text).map((entry) => entry.lemma),
      line,
    });
  }

  const matches = findPhrases(phraseTokens, phraseIndex);

  if (matches.length === 0) {
    return [];
  }

  const normalizedPhrases = Array.from(
    new Set(matches.map((match) => match.phrase.normalized)),
  );
  const lexemes = await prisma.lexeme.findMany({
    where: { normalizedLemma: { in: normalizedPhrases } },
    select: { id: true, normalizedLemma: true },
  });
  const lexemeByPhrase = new Map(
    lexemes.map((lexeme) => [lexeme.normalizedLemma, lexeme.id]),
  );
  const lexemeIds = Array.from(lexemeByPhrase.values());
  const userEntries =
    lexemeIds.length > 0
      ? await prisma.userLexeme.findMany({
          where: { userId, lexemeId: { in: lexemeIds } },
          select: { lexemeId: true, isFavorite: true, dueAt: true },
        })
      : [];
  const userByLexemeId = new Map(
    userEntries.map((entry) => [entry.lexemeId, entry]),
  );

  return matches.map((match) => {
    const lexemeId = lexemeByPhrase.get(match.phrase.normalized) ?? null;
    const userEntry = lexemeId ? userByLexemeId.get(lexemeId) : undefined;

    return {
      start: match.start,
      end: match.end,
      normalized: match.phrase.normalized,
      canonical: match.phrase.canonical,
      pos: match.phrase.pos,
      lexemeId,
      inWordBook: Boolean(userEntry),
      isFavorite: userEntry?.isFavorite ?? false,
      dueAt: userEntry?.dueAt ? userEntry.dueAt.toISOString() : null,
    };
  });
}

/**
 * Annotates a pasted article against the user's word book and the offline
 * dictionary data. Purely read-only: no writing, no dictionary network calls.
 */
export async function analyzeReaderText({
  userId,
  text,
}: {
  userId: string;
  text: string;
}): Promise<ReaderAnalysis> {
  if (text.length > READER_MAX_CHARS) {
    throw new ReaderTextTooLongError();
  }

  const rawTokens = tokenizeWords(text);
  const surfaces = new Map<string, string>();

  for (const token of rawTokens) {
    const key = normalizeSurface(token.text);

    if (!surfaces.has(key)) {
      surfaces.set(key, token.text);
    }
  }

  const candidates = collectCandidates(Array.from(surfaces.values()));
  const [userForms, globalLemmas, phraseIndex] = await Promise.all([
    buildUserFormIndex(userId),
    buildGlobalIndex(candidates),
    getPhraseIndex().catch((error) => {
      // The phrase vocabulary is additive: never let it break the word-level
      // annotation, and retry on the next request instead of caching a failure.
      console.error("reader phrase vocabulary load failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }),
  ]);
  const lexicon: ReaderLexicon = { userForms, globalLemmas };
  const resolutionCache = new Map<string, ReturnType<typeof classifySurface>>();
  const tokens: ReaderToken[] = rawTokens.map((token) => {
    const key = normalizeSurface(token.text);
    const cached = resolutionCache.get(key);
    const resolved = cached ?? classifySurface(token.text, lexicon);

    if (!cached) {
      resolutionCache.set(key, resolved);
    }

    return {
      text: token.text,
      start: token.start,
      end: token.end,
      ...resolved,
    };
  });

  // Phrase detection is additive: if it fails (or the phrase vocabulary cannot
  // be loaded), the annotation still returns the word-level result.
  let phrases: ReaderPhrase[] = [];

  try {
    phrases = await resolvePhrases({
      userId,
      text,
      rawTokens,
      phraseIndex,
    });
  } catch (error) {
    console.error("reader phrase detection failed", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return {
    tokens,
    phrases,
    stats: summarizeTokens(tokens),
  };
}
