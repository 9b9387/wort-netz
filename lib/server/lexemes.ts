import "server-only";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { LexemeModel } from "@/lib/generated/prisma/models/Lexeme";
import {
  lookupDwds,
  normalizeLexeme,
  type DwdsLookup,
} from "@/lib/server/dwds";
import { getEnglishDictionaryEntry } from "@/lib/server/freedictionary";
import {
  hasWordnetEntry,
  syncLexemeToWordnet,
  getWordnetContentForLexeme,
  type WordnetContent,
} from "@/lib/server/wordnet";
import {
  sortVocabularyLevels,
  syncLexemeVocabularyLevels,
  type VocabularyLevelInfo,
} from "@/lib/server/vocabulary-levels";
import {
  DEFAULT_WORD_BOOK_SORT,
  WORD_BOOK_PAGE_SIZE,
  type WordBookSort,
} from "@/lib/wordbook/sort";
import { wordfeatherPhrasePos } from "@/lib/reader/phrases";
import { supplementalPhrase } from "@/lib/reader/phrase-supplement";

export class LexemeNotFoundError extends Error {
  constructor(query: string) {
    super(`Lexeme not found: ${query}`);
    this.name = "LexemeNotFoundError";
  }
}

export type RecentWord = {
  lexemeId: string;
  canonicalLemma: string;
  wordType: string | null;
  frequencyClass: number | null;
  ipa: string | null;
  isFavorite: boolean;
  /** Lowest CEFR level of the entry, when the vocabulary list knows it. */
  level: string | null;
  /** First English sense, used as the meaning shown in the word book. */
  definitionEn: string | null;
  /** Curated Chinese gloss for multi-word expressions, when available. */
  gloss: string | null;
  /** Forms this user has actually met, newest first ("ist", "war", …). */
  surfaceForms: string[];
  /** Lemma this entry is a form of, for entries stored as a form. */
  baseLemma: string | null;
  /** Learning status: NEW / LEARNING / REVIEWING / MASTERED / SUSPENDED. */
  status: string;
  encounterCount: number;
  lastSeenAt: Date;
};

export type UserWordDetail = {
  lexeme: LexemeModel;
  encounterCount: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  isFavorite: boolean;
  reviewStatus: string;
  leitnerBox: number;
  dueAt: Date | null;
  intervalDays: number;
  easeFactor: number;
  repetitions: number;
  lapses: number;
  lastReviewedAt: Date | null;
  noteContent: string;
  noteUpdatedAt: Date | null;
  wordnet: WordnetContent | null;
  vocabularyLevels: VocabularyLevelInfo[];
  surfaceForms: Array<{
    surfaceForm: string;
    createdAt: Date;
  }>;
  /** Lemma this entry is a form of, when it was stored as a form entry. */
  baseLexeme: { id: string; canonicalLemma: string } | null;
};

const LOOKUP_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DWDS_LOOKUP_CACHE_KEY = "lookup";

function isNounWordType(wordType: string | null | undefined): boolean {
  return (
    wordType === "Substantiv" ||
    wordType === "Eigenname" ||
    wordType?.includes("Substantiv") === true
  );
}

/**
 * Multi-word expressions are created from the imported OdeNet vocabulary instead
 * of DWDS, and are marked in `sourceJson` so they skip word-level backfills.
 */
export function isDerivedLexeme(lexeme: LexemeModel): boolean {
  const source = lexeme.sourceJson;

  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return false;
  }

  const kind = (source as { kind?: unknown }).kind;

  return kind === "phrase" || kind === "form";
}

async function lookupDwdsCached(query: string): Promise<DwdsLookup> {
  const normalizedQuery = normalizeLexeme(query);
  const cached = await prisma.dwdsCache.findUnique({
    where: {
      endpoint_query: {
        endpoint: DWDS_LOOKUP_CACHE_KEY,
        query: normalizedQuery,
      },
    },
  });

  if (
    cached &&
    cached.fetchedAt.getTime() > Date.now() - LOOKUP_CACHE_TTL_MS
  ) {
    const payload = cached.payload as unknown as DwdsLookup;
    const cachedGender = (cached.payload as { gender?: unknown }).gender;
    const needsGender =
      isNounWordType(payload.wordType) && cachedGender === undefined;

    if (!needsGender) {
      return payload;
    }
  }

  const lookup = await lookupDwds(query);

  await prisma.dwdsCache.upsert({
    where: {
      endpoint_query: {
        endpoint: DWDS_LOOKUP_CACHE_KEY,
        query: normalizedQuery,
      },
    },
    update: {
      payload: lookup as unknown as Prisma.InputJsonValue,
      fetchedAt: new Date(),
    },
    create: {
      endpoint: DWDS_LOOKUP_CACHE_KEY,
      query: normalizedQuery,
      payload: lookup as unknown as Prisma.InputJsonValue,
    },
  });

  return lookup;
}

export async function findOrCreateLexeme(query: string): Promise<LexemeModel> {
  const lookup = await lookupDwdsCached(query);
  const normalizedLemma = normalizeLexeme(lookup.canonicalLemma);
  const sourceJson = lookup.sourceJson as unknown as Prisma.InputJsonValue;
  const dictionary = await getEnglishDictionaryEntry(
    lookup.canonicalLemma,
    lookup.wordType,
  ).catch((error) => {
    console.error("FreeDictionaryAPI lookup failed", {
      lemma: lookup.canonicalLemma,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  });
  const hasOdeNetEntry = await hasWordnetEntry(normalizedLemma);
  const hasDictionaryContent =
    Boolean(dictionary?.definitionEn) ||
    (dictionary?.formsJson?.forms.length ?? 0) > 0;

  if (!lookup.found && !hasDictionaryContent && !hasOdeNetEntry) {
    throw new LexemeNotFoundError(query);
  }

  const dictionaryFields = dictionary
    ? {
        definitionEn: dictionary.definitionEn,
        dictionaryUrl: dictionary.dictionaryUrl,
        dictionarySource: dictionary.dictionarySource,
        dictionaryLicense: dictionary.dictionaryLicense,
        dictionaryFetchedAt: new Date(),
        ...(dictionary.formsJson
          ? {
              formsJson: dictionary.formsJson as unknown as Prisma.InputJsonValue,
            }
          : {}),
      }
    : {};

  const lexeme = await prisma.lexeme.upsert({
    where: { normalizedLemma },
    update: {
      canonicalLemma: lookup.canonicalLemma,
      wordType: lookup.wordType,
      gender: lookup.gender,
      frequencyClass: lookup.frequencyClass,
      ipa: lookup.ipa,
      dwdsUrl: lookup.dwdsUrl,
      sourceJson,
      sourceFetchedAt: new Date(),
      ...dictionaryFields,
    },
    create: {
      normalizedLemma,
      canonicalLemma: lookup.canonicalLemma,
      wordType: lookup.wordType,
      gender: lookup.gender,
      frequencyClass: lookup.frequencyClass,
      ipa: lookup.ipa,
      dwdsUrl: lookup.dwdsUrl,
      sourceJson,
      sourceFetchedAt: new Date(),
      ...dictionaryFields,
    },
  });

  await syncLexemeToWordnet({
    id: lexeme.id,
    normalizedLemma: lexeme.normalizedLemma,
    wordType: lexeme.wordType,
  });
  await syncLexemeVocabularyLevels({
    id: lexeme.id,
    normalizedLemma: lexeme.normalizedLemma,
    wordType: lexeme.wordType,
  });

  return lexeme;
}

/** DWDS-style word type so the existing WordNet/vocabulary helpers keep working. */
function phraseWordType(partOfSpeech: string | null): string | null {
  if (partOfSpeech === "n") {
    return "Substantiv";
  }

  if (partOfSpeech === "v") {
    return "Verb";
  }

  if (partOfSpeech === "a") {
    return "Adjektiv";
  }

  if (partOfSpeech === "r") {
    return "Adverb";
  }

  return null;
}

/**
 * Creates (or reuses) the dictionary entry for a multi-word expression found in
 * an article. Phrases are backed by the imported OdeNet vocabulary: there is no
 * DWDS lookup, and the synset link is set up so definitions and examples render
 * through the regular word detail view.
 */
export async function findOrCreatePhraseLexeme(input: {
  normalized: string;
  canonical: string;
  pos: string | null;
}): Promise<LexemeModel | null> {
  const normalizedLemma = normalizeLexeme(input.normalized);
  const existing = await prisma.lexeme.findUnique({
    where: { normalizedLemma },
  });

  if (existing) {
    return existing;
  }

  const entry = await prisma.wordnetLexicalEntry.findFirst({
    where: {
      normalizedLemma,
      ...(input.pos ? { partOfSpeech: input.pos } : {}),
    },
    select: { partOfSpeech: true },
  });
  const level = await prisma.vocabularyLevel.findFirst({
        where: { normalizedLemma },
        orderBy: { confidence: "desc" },
        select: {
          level: true,
          partOfSpeech: true,
          translationEn: true,
          exampleDe: true,
        },
      });
  const curated = supplementalPhrase(normalizedLemma);

  if (!entry && !level && !curated) {
    return null;
  }

  const wordType = entry
    ? phraseWordType(entry.partOfSpeech)
    : level
      ? phraseWordType(wordfeatherPhrasePos(level.partOfSpeech))
      : phraseWordType(curated?.pos ?? null);
  const definitionEn = level?.translationEn ?? null;
  const sourceJson = entry
    ? {
        kind: "phrase",
        source: "odenet",
        partOfSpeech: entry.partOfSpeech,
        gloss: curated?.gloss ?? null,
      }
    : {
        kind: "phrase",
        source: level ? "wordfeather" : "curated",
        level: level?.level ?? null,
        example: level?.exampleDe ?? null,
        gloss: curated?.gloss ?? null,
      };

  try {
    const lexeme = await prisma.lexeme.create({
      data: {
        normalizedLemma,
        canonicalLemma: input.canonical.trim() || normalizedLemma,
        wordType,
        definitionEn,
        sourceJson: sourceJson as Prisma.InputJsonValue,
        sourceFetchedAt: new Date(),
      },
    });

    if (entry) {
      await syncLexemeToWordnet({
        id: lexeme.id,
        normalizedLemma: lexeme.normalizedLemma,
        wordType: lexeme.wordType,
      });
    }

    await syncLexemeVocabularyLevels({
      id: lexeme.id,
      normalizedLemma: lexeme.normalizedLemma,
      wordType: lexeme.wordType,
    });

    return lexeme;
  } catch (error) {
    // Another request may have created the same phrase in the meantime.
    const raced = await prisma.lexeme.findUnique({
      where: { normalizedLemma },
    });

    if (raced) {
      return raced;
    }

    console.error("findOrCreatePhraseLexeme failed", {
      normalizedLemma,
      error: error instanceof Error ? error.message : String(error),
    });

    return null;
  }
}

/**
 * Stores the form the user looked up as its own entry, linked to the lemma it
 * belongs to. Searching or clicking "ist" therefore keeps "ist" in the word book
 * with a link to "sein" instead of being merged into it.
 */
export async function findOrCreateFormLexeme(input: {
  surfaceForm: string;
  baseLexemeId: string;
}): Promise<LexemeModel> {
  const normalizedLemma = normalizeLexeme(input.surfaceForm);
  const base = await prisma.lexeme.findUnique({
    where: { id: input.baseLexemeId },
  });

  if (!base) {
    throw new LexemeNotFoundError(input.surfaceForm);
  }

  const existing = await prisma.lexeme.findUnique({
    where: { normalizedLemma },
  });
  const form =
    existing ??
    (await prisma.lexeme.create({
      data: {
        normalizedLemma,
        canonicalLemma: input.surfaceForm.normalize("NFC").trim(),
        wordType: base.wordType,
        sourceJson: {
          kind: "form",
          baseLexemeId: base.id,
          baseLemma: base.canonicalLemma,
        } as Prisma.InputJsonValue,
        sourceFetchedAt: new Date(),
      },
    }));

  await prisma.lexemeRelation.upsert({
    where: {
      sourceLexemeId_targetNormalizedLemma_relationType_sourceName: {
        sourceLexemeId: form.id,
        targetNormalizedLemma: base.normalizedLemma,
        relationType: "form-of",
        sourceName: "user",
      },
    },
    update: {
      targetLexemeId: base.id,
      targetLemma: base.canonicalLemma,
    },
    create: {
      sourceLexemeId: form.id,
      targetLexemeId: base.id,
      targetLemma: base.canonicalLemma,
      targetNormalizedLemma: base.normalizedLemma,
      relationType: "form-of",
      sourceName: "user",
    },
  });

  // The form shares the lemma's word class and vocabulary level.
  await syncLexemeVocabularyLevels({
    id: form.id,
    normalizedLemma: base.normalizedLemma,
    wordType: base.wordType,
  });

  return form;
}

export async function recordEncounter(
  userId: string,
  lexemeId: string,
  surfaceForm: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.encounter.create({
      data: {
        userId,
        lexemeId,
        surfaceForm,
      },
    });

    await tx.userLexeme.upsert({
      where: {
        userId_lexemeId: {
          userId,
          lexemeId,
        },
      },
      update: {
        lastSeenAt: new Date(),
        encounterCount: {
          increment: 1,
        },
      },
      create: {
        userId,
        lexemeId,
        encounterCount: 1,
      },
    });
  });
}

export async function getLexemeById(id: string): Promise<LexemeModel | null> {
  return prisma.lexeme.findUnique({ where: { id } });
}

export async function getUserStats(userId: string): Promise<{
  totalWords: number;
  totalEncounters: number;
}> {
  const [totalWords, aggregate] = await Promise.all([
    prisma.userLexeme.count({ where: { userId } }),
    prisma.userLexeme.aggregate({
      where: { userId },
      _sum: { encounterCount: true },
    }),
  ]);

  return {
    totalWords,
    totalEncounters: aggregate._sum.encounterCount ?? 0,
  };
}

const WORD_BOOK_ORDER_BY = {
  recent: [{ lastSeenAt: "desc" }, { lexemeId: "asc" }],
  encounters: [{ encounterCount: "desc" }, { lastSeenAt: "desc" }],
  due: [{ dueAt: "asc" }, { lastSeenAt: "desc" }],
  alphabet: [
    { lexeme: { canonicalLemma: "asc" } },
    { lexemeId: "asc" },
  ],
} as const satisfies Record<WordBookSort, Prisma.UserLexemeOrderByWithRelationInput[]>;

/**
 * One page of the word book. `hasMore` is derived by fetching one extra row, so
 * the list can append pages without a separate count query.
 */
export async function getWordBookWords(
  userId: string,
  options: {
    sort?: WordBookSort;
    query?: string | null;
    status?: string | null;
    favorites?: boolean;
    offset?: number;
    limit?: number;
  } = {},
): Promise<{ words: RecentWord[]; hasMore: boolean }> {
  const limit = options.limit ?? WORD_BOOK_PAGE_SIZE;
  const search = options.query?.trim();
  const rows = await prisma.userLexeme.findMany({
    where: {
      userId,
      ...(options.status ? { status: options.status } : {}),
      ...(options.favorites ? { isFavorite: true } : {}),
      ...(search
        ? {
            lexeme: {
              OR: [
                {
                  canonicalLemma: { contains: search, mode: "insensitive" },
                },
              ],
            },
          }
        : {}),
    },
    orderBy: WORD_BOOK_ORDER_BY[options.sort ?? DEFAULT_WORD_BOOK_SORT],
    skip: options.offset ?? 0,
    take: limit + 1,
    include: {
      lexeme: {
        include: {
          vocabularyLevels: { select: { level: true } },
          encounters: {
            where: { userId },
            orderBy: { createdAt: "desc" },
            take: 5,
            select: { surfaceForm: true },
          },
          relationsFrom: {
            where: { relationType: "form-of" },
            take: 1,
            select: { targetLemma: true },
          },
        },
      },
    },
  });

  return {
    words: rows.slice(0, limit).map((row) => ({
    lexemeId: row.lexemeId,
    canonicalLemma: row.lexeme.canonicalLemma,
    wordType: row.lexeme.wordType,
    frequencyClass: row.lexeme.frequencyClass,
    ipa: row.lexeme.ipa,
    isFavorite: row.isFavorite,
    level: sortVocabularyLevels(row.lexeme.vocabularyLevels)[0]?.level ?? null,
    definitionEn: row.lexeme.definitionEn?.split("\n")[0]?.trim() ?? null,
    gloss: readPhraseGloss(row.lexeme.sourceJson),
    surfaceForms: Array.from(
      new Set(row.lexeme.encounters.map((encounter) => encounter.surfaceForm)),
    ),
    baseLemma: row.lexeme.relationsFrom[0]?.targetLemma ?? null,
    status: row.status,
    encounterCount: row.encounterCount,
    lastSeenAt: row.lastSeenAt,
    })),
    hasMore: rows.length > limit,
  };
}

/** `sourceJson.gloss` of a curated phrase entry, when present. */
function readPhraseGloss(sourceJson: unknown): string | null {
  if (!sourceJson || typeof sourceJson !== "object" || Array.isArray(sourceJson)) {
    return null;
  }

  const gloss = (sourceJson as { gloss?: unknown }).gloss;

  return typeof gloss === "string" && gloss.trim() ? gloss.trim() : null;
}

async function ensureLexemeGender(lexeme: LexemeModel): Promise<LexemeModel> {
  if (
    lexeme.gender ||
    !isNounWordType(lexeme.wordType) ||
    isDerivedLexeme(lexeme)
  ) {
    return lexeme;
  }

  try {
    const lookup = await lookupDwdsCached(lexeme.canonicalLemma);

    if (!lookup.gender) {
      return lexeme;
    }

    return await prisma.lexeme.update({
      where: { id: lexeme.id },
      data: { gender: lookup.gender },
    });
  } catch (error) {
    console.error("Lexeme gender backfill failed", {
      lexemeId: lexeme.id,
      lemma: lexeme.canonicalLemma,
      error: error instanceof Error ? error.message : String(error),
    });
    return lexeme;
  }
}

export async function getUserWordDetail(
  userId: string,
  lexemeId: string,
): Promise<UserWordDetail | null> {
  // One batched read for the entry plus the current user's learning data keeps
  // this to a single connection instead of several parallel ones.
  const lexeme = await prisma.lexeme.findUnique({
    where: { id: lexemeId },
    include: {
      userLexemes: {
        where: { userId },
        take: 1,
      },
      encounters: {
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          surfaceForm: true,
          createdAt: true,
        },
      },
      wordNotes: {
        where: { userId },
        take: 1,
        select: {
          content: true,
          updatedAt: true,
        },
      },
      vocabularyLevels: {
        select: {
          level: true,
          source: true,
          confidence: true,
        },
      },
      relationsFrom: {
        where: { relationType: "form-of" },
        take: 1,
        select: {
          targetLexeme: {
            select: { id: true, canonicalLemma: true, normalizedLemma: true },
          },
        },
      },
    },
  });

  if (!lexeme) {
    return null;
  }

  const userLexeme = lexeme.userLexemes[0] ?? null;
  const note = lexeme.wordNotes[0] ?? null;
  const lexemeWithGender = await ensureLexemeGender(lexeme);
  const baseLexeme = lexeme.relationsFrom[0]?.targetLexeme ?? null;
  /**
   * A form entry ("ist") carries no dictionary content of its own, so the entry
   * it belongs to ("sein") supplies definitions, examples and relations.
   */
  const [wordnet, base] = await Promise.all([
    getWordnetContentForLexeme(
      baseLexeme
        ? {
            id: baseLexeme.id,
            canonicalLemma: baseLexeme.canonicalLemma,
            normalizedLemma: baseLexeme.normalizedLemma,
          }
        : {
            id: lexemeWithGender.id,
            canonicalLemma: lexemeWithGender.canonicalLemma,
            normalizedLemma: lexemeWithGender.normalizedLemma,
          },
    ),
    baseLexeme
      ? prisma.lexeme.findUnique({
          where: { id: baseLexeme.id },
          select: { definitionEn: true },
        })
      : Promise.resolve(null),
  ]);

  return {
    lexeme: base
      ? {
          ...lexemeWithGender,
          definitionEn:
            lexemeWithGender.definitionEn ?? base.definitionEn ?? null,
        }
      : lexemeWithGender,
    encounterCount: userLexeme?.encounterCount ?? 0,
    firstSeenAt: userLexeme?.firstSeenAt ?? lexeme.createdAt,
    lastSeenAt: userLexeme?.lastSeenAt ?? lexeme.createdAt,
    isFavorite: userLexeme?.isFavorite ?? false,
    reviewStatus: userLexeme?.status ?? "NEW",
    leitnerBox: userLexeme?.leitnerBox ?? 0,
    dueAt: userLexeme?.dueAt ?? null,
    intervalDays: userLexeme?.intervalDays ?? 0,
    easeFactor: userLexeme?.easeFactor ?? 2.5,
    repetitions: userLexeme?.repetitions ?? 0,
    lapses: userLexeme?.lapses ?? 0,
    lastReviewedAt: userLexeme?.lastReviewedAt ?? null,
    noteContent: note?.content ?? "",
    noteUpdatedAt: note?.updatedAt ?? null,
    wordnet,
    vocabularyLevels: sortVocabularyLevels(lexeme.vocabularyLevels),
    surfaceForms: lexeme.encounters,
    baseLexeme: lexeme.relationsFrom[0]?.targetLexeme ?? null,
  };
}
