import "server-only";

import { prisma } from "@/lib/prisma";

export const VOCABULARY_LEVEL_ORDER = [
  "A1",
  "A2",
  "B1",
  "B2",
  "C1",
  "C2",
] as const;

export type VocabularyLevelInfo = {
  level: string;
  source: string;
  confidence: number | null;
};

function levelRank(level: string): number {
  const index = VOCABULARY_LEVEL_ORDER.indexOf(
    level as (typeof VOCABULARY_LEVEL_ORDER)[number],
  );

  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function wordfeatherPosFromDwds(wordType: string | null): string | null {
  if (!wordType) {
    return null;
  }

  if (wordType.includes("Substantiv") || wordType === "Eigenname") {
    return "noun";
  }

  if (wordType.includes("Verb")) {
    return "verb";
  }

  if (wordType.includes("Adjektiv")) {
    return "adj";
  }

  if (wordType.includes("Adverb")) {
    return "adv";
  }

  if (wordType.includes("Pronomen")) {
    return "pron";
  }

  if (wordType.includes("Präposition")) {
    return "prep";
  }

  if (wordType.includes("Konjunktion")) {
    return "conj";
  }

  if (wordType.includes("Artikel")) {
    return "art";
  }

  return null;
}

export async function getVocabularyLevelsForLexeme(
  lexemeId: string,
): Promise<VocabularyLevelInfo[]> {
  const rows = await prisma.lexemeVocabularyLevel.findMany({
    where: {
      lexemeId,
    },
    select: {
      level: true,
      source: true,
      confidence: true,
    },
  });

  return rows.sort((a, b) => levelRank(a.level) - levelRank(b.level));
}

export async function syncLexemeVocabularyLevels(lexeme: {
  id: string;
  normalizedLemma: string;
  wordType: string | null;
}): Promise<VocabularyLevelInfo[]> {
  const candidates = await prisma.vocabularyLevel.findMany({
    where: {
      normalizedLemma: lexeme.normalizedLemma,
    },
    select: {
      level: true,
      partOfSpeech: true,
      source: true,
      confidence: true,
    },
  });
  const wantedPartOfSpeech = wordfeatherPosFromDwds(lexeme.wordType);
  const exactMatches = wantedPartOfSpeech
    ? candidates.filter(
        (candidate) => candidate.partOfSpeech === wantedPartOfSpeech,
      )
    : [];
  const matches = exactMatches.length > 0 ? exactMatches : candidates;
  const byLevel = new Map<string, VocabularyLevelInfo>();

  for (const match of matches) {
    const current = byLevel.get(match.level);

    if (
      !current ||
      (match.confidence ?? 0) > (current.confidence ?? 0)
    ) {
      byLevel.set(match.level, {
        level: match.level,
        source: match.source,
        confidence: match.confidence,
      });
    }
  }

  const levels = Array.from(byLevel.values()).sort(
    (a, b) => levelRank(a.level) - levelRank(b.level),
  );

  await prisma.lexemeVocabularyLevel.deleteMany({
    where: {
      lexemeId: lexeme.id,
    },
  });

  if (levels.length > 0) {
    await prisma.lexemeVocabularyLevel.createMany({
      data: levels.map((level) => ({
        lexemeId: lexeme.id,
        level: level.level,
        source: level.source,
        confidence: level.confidence,
      })),
      skipDuplicates: true,
    });
  }

  return levels;
}
