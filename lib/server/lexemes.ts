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
  getVocabularyLevelsForLexeme,
  syncLexemeVocabularyLevels,
  type VocabularyLevelInfo,
} from "@/lib/server/vocabulary-levels";

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

export async function getRecentUserWords(
  userId: string,
  limit = 20,
): Promise<RecentWord[]> {
  const rows = await prisma.userLexeme.findMany({
    where: { userId },
    orderBy: { lastSeenAt: "desc" },
    take: limit,
    include: {
      lexeme: true,
    },
  });

  return rows.map((row) => ({
    lexemeId: row.lexemeId,
    canonicalLemma: row.lexeme.canonicalLemma,
    wordType: row.lexeme.wordType,
    frequencyClass: row.lexeme.frequencyClass,
    ipa: row.lexeme.ipa,
    encounterCount: row.encounterCount,
    lastSeenAt: row.lastSeenAt,
  }));
}

async function ensureLexemeGender(lexeme: LexemeModel): Promise<LexemeModel> {
  if (lexeme.gender || !isNounWordType(lexeme.wordType)) {
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
  const [lexeme, userLexeme, encounters, note] = await Promise.all([
    prisma.lexeme.findUnique({ where: { id: lexemeId } }),
    prisma.userLexeme.findUnique({
      where: {
        userId_lexemeId: {
          userId,
          lexemeId,
        },
      },
    }),
    prisma.encounter.findMany({
      where: { userId, lexemeId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        surfaceForm: true,
        createdAt: true,
      },
    }),
    prisma.userWordNote.findUnique({
      where: {
        userId_lexemeId: {
          userId,
          lexemeId,
        },
      },
      select: {
        content: true,
        updatedAt: true,
      },
    }),
  ]);

  if (!lexeme) {
    return null;
  }

  const lexemeWithGender = await ensureLexemeGender(lexeme);
  const wordnet = await getWordnetContentForLexeme({
    id: lexemeWithGender.id,
    canonicalLemma: lexemeWithGender.canonicalLemma,
    normalizedLemma: lexemeWithGender.normalizedLemma,
  });
  const vocabularyLevels = await getVocabularyLevelsForLexeme(
    lexemeWithGender.id,
  );

  return {
    lexeme: lexemeWithGender,
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
    vocabularyLevels,
    surfaceForms: encounters,
  };
}
