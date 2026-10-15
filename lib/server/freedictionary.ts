import "server-only";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";
import { fetchJson } from "@/lib/server/http";
import { normalizeLexeme } from "@/lib/server/dwds";
import {
  parseFreeDictionaryResponse,
  type EnglishDictionaryResult,
  type FreeDictionaryResponse,
} from "@/lib/server/freedictionary-parser";

const FREE_DICTIONARY_BASE_URL = "https://freedictionaryapi.com/api/v1";
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const CACHE_ENDPOINT = "freedictionary";

export type { EnglishDictionaryResult };

export async function getEnglishDictionaryEntry(
  lemma: string,
  wordType: string | null,
): Promise<EnglishDictionaryResult | null> {
  const normalizedLemma = normalizeLexeme(lemma);
  const cached = await prisma.dwdsCache.findUnique({
    where: {
      endpoint_query: {
        endpoint: CACHE_ENDPOINT,
        query: normalizedLemma,
      },
    },
  });

  if (
    cached &&
    cached.fetchedAt.getTime() > Date.now() - CACHE_TTL_MS
  ) {
    return cached.payload as unknown as EnglishDictionaryResult;
  }

  const response = await fetchJson<FreeDictionaryResponse>(
    `${FREE_DICTIONARY_BASE_URL}/entries/de/${encodeURIComponent(lemma)}`,
  );
  const result = parseFreeDictionaryResponse(response, lemma, wordType);

  if (!result) {
    return null;
  }

  await prisma.dwdsCache.upsert({
    where: {
      endpoint_query: {
        endpoint: CACHE_ENDPOINT,
        query: normalizedLemma,
      },
    },
    update: {
      payload: result as unknown as Prisma.InputJsonValue,
      fetchedAt: new Date(),
    },
    create: {
      endpoint: CACHE_ENDPOINT,
      query: normalizedLemma,
      payload: result as unknown as Prisma.InputJsonValue,
    },
  });

  return result;
}
