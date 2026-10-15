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
  surfaceForms: Array<{
    surfaceForm: string;
    createdAt: Date;
  }>;
};

const LOOKUP_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DWDS_LOOKUP_CACHE_KEY = "lookup";

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
    return cached.payload as unknown as DwdsLookup;
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

  return prisma.lexeme.upsert({
    where: { normalizedLemma },
    update: {
      canonicalLemma: lookup.canonicalLemma,
      wordType: lookup.wordType,
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
      frequencyClass: lookup.frequencyClass,
      ipa: lookup.ipa,
      dwdsUrl: lookup.dwdsUrl,
      sourceJson,
      sourceFetchedAt: new Date(),
      ...dictionaryFields,
    },
  });
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

export async function getUserWordDetail(
  userId: string,
  lexemeId: string,
): Promise<UserWordDetail | null> {
  const [lexeme, userLexeme, encounters] = await Promise.all([
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
  ]);

  if (!lexeme) {
    return null;
  }

  return {
    lexeme,
    encounterCount: userLexeme?.encounterCount ?? 0,
    firstSeenAt: userLexeme?.firstSeenAt ?? lexeme.createdAt,
    lastSeenAt: userLexeme?.lastSeenAt ?? lexeme.createdAt,
    surfaceForms: encounters,
  };
}
