import "server-only";

import { prisma } from "@/lib/prisma";

export type WordnetRelatedWord = {
  lemma: string;
  partOfSpeech: string | null;
  lexemeId: string | null;
};

export type WordnetContent = {
  definitions: Array<{
    language: string;
    text: string;
  }>;
  examples: string[];
  synonyms: WordnetRelatedWord[];
  antonyms: WordnetRelatedWord[];
  hypernyms: WordnetRelatedWord[];
  hyponyms: WordnetRelatedWord[];
  source: {
    version: string;
    license: string;
    sourceUrl: string;
  } | null;
};

function normalizeLemma(value: string): string {
  return value.normalize("NFC").trim().toLowerCase();
}

export function wordnetPosFromDwds(wordType: string | null): string | null {
  if (!wordType) {
    return null;
  }

  if (wordType.includes("Substantiv") || wordType === "Eigenname") {
    return "n";
  }

  if (wordType.includes("Verb")) {
    return "v";
  }

  if (wordType.includes("Adjektiv")) {
    return "a";
  }

  if (wordType.includes("Adverb")) {
    return "r";
  }

  return null;
}

export async function hasWordnetEntry(
  normalizedLemma: string,
): Promise<boolean> {
  const entry = await prisma.wordnetLexicalEntry.findFirst({
    where: {
      normalizedLemma,
    },
    select: {
      id: true,
    },
  });

  return Boolean(entry);
}

export async function syncLexemeToWordnet(lexeme: {
  id: string;
  normalizedLemma: string;
  wordType: string | null;
}): Promise<number> {
  const partOfSpeech = wordnetPosFromDwds(lexeme.wordType);
  let entries = await prisma.wordnetLexicalEntry.findMany({
    where: {
      normalizedLemma: lexeme.normalizedLemma,
      ...(partOfSpeech ? { partOfSpeech } : {}),
    },
    select: {
      senses: {
        select: {
          synsetId: true,
        },
      },
    },
  });
  let matchType = partOfSpeech ? "lemma_pos" : "lemma";

  if (entries.length === 0 && partOfSpeech) {
    entries = await prisma.wordnetLexicalEntry.findMany({
      where: {
        normalizedLemma: lexeme.normalizedLemma,
      },
      select: {
        senses: {
          select: {
            synsetId: true,
          },
        },
      },
    });
    matchType = "lemma";
  }

  const synsetIds = Array.from(
    new Set(
      entries.flatMap((entry) =>
        entry.senses.map((sense) => sense.synsetId),
      ),
    ),
  );

  await prisma.lexemeSynset.deleteMany({
    where: {
      lexemeId: lexeme.id,
    },
  });

  if (synsetIds.length === 0) {
    return 0;
  }

  await prisma.lexemeSynset.createMany({
    data: synsetIds.map((synsetId) => ({
      lexemeId: lexeme.id,
      synsetId,
      matchType,
      confidence: matchType === "lemma_pos" ? 1 : 0.7,
    })),
    skipDuplicates: true,
  });

  return synsetIds.length;
}

function uniqueByKey<T>(
  rows: T[],
  keyFor: (row: T) => string,
): T[] {
  return Array.from(
    new Map(rows.map((row) => [keyFor(row), row])).values(),
  );
}

async function attachLexemeLinks(
  words: Array<{ lemma: string; partOfSpeech: string | null }>,
): Promise<WordnetRelatedWord[]> {
  const normalizedLemmas = Array.from(
    new Set(words.map((word) => normalizeLemma(word.lemma))),
  );
  const lexemes =
    normalizedLemmas.length === 0
      ? []
      : await prisma.lexeme.findMany({
          where: {
            normalizedLemma: {
              in: normalizedLemmas,
            },
          },
          select: {
            id: true,
            normalizedLemma: true,
          },
        });
  const lexemeByLemma = new Map(
    lexemes.map((lexeme) => [lexeme.normalizedLemma, lexeme.id]),
  );

  return words.map((word) => ({
    ...word,
    lexemeId: lexemeByLemma.get(normalizeLemma(word.lemma)) ?? null,
  }));
}

function wordsFromSynset(synset: {
  senses: Array<{
    entry: {
      lemma: string;
      partOfSpeech: string | null;
    };
  }>;
}): Array<{ lemma: string; partOfSpeech: string | null }> {
  return uniqueByKey(
    synset.senses.map((sense) => ({
      lemma: sense.entry.lemma,
      partOfSpeech: sense.entry.partOfSpeech,
    })),
    (word) => `${normalizeLemma(word.lemma)}|${word.partOfSpeech ?? ""}`,
  );
}

export async function getWordnetContentForLexeme(lexeme: {
  id: string;
  canonicalLemma: string;
  normalizedLemma: string;
}): Promise<WordnetContent | null> {
  const links = await prisma.lexemeSynset.findMany({
    where: {
      lexemeId: lexeme.id,
    },
    select: {
      synsetId: true,
    },
  });

  if (links.length === 0) {
    return null;
  }

  const synsetIds = links.map((link) => link.synsetId);
  const synsets = await prisma.wordnetSynset.findMany({
    where: {
      id: {
        in: synsetIds,
      },
    },
    include: {
      definitions: true,
      examples: true,
      senses: {
        include: {
          entry: true,
        },
      },
    },
  });

  const definitions = uniqueByKey(
    synsets.flatMap((synset) => [
      ...synset.definitions.map((definition) => ({
        language: definition.language,
        text: definition.text,
      })),
      ...(synset.descriptionEn
        ? [{ language: "en", text: synset.descriptionEn }]
        : []),
    ]),
    (definition) => `${definition.language}|${definition.text}`,
  );
  const examples = Array.from(
    new Set(
      synsets.flatMap((synset) =>
        synset.examples.map((example) => example.text),
      ),
    ),
  );

  const synonymWords = uniqueByKey(
    synsets.flatMap((synset) =>
      wordsFromSynset(synset).filter(
        (word) =>
          normalizeLemma(word.lemma) !==
          normalizeLemma(lexeme.canonicalLemma),
      ),
    ),
    (word) => `${normalizeLemma(word.lemma)}|${word.partOfSpeech ?? ""}`,
  );

  const sourceSenses = await prisma.wordnetSense.findMany({
    where: {
      synsetId: {
        in: synsetIds,
      },
      entry: {
        normalizedLemma: lexeme.normalizedLemma,
      },
    },
    select: {
      id: true,
    },
  });

  const antonymRelations =
    sourceSenses.length === 0
      ? []
      : await prisma.wordnetSenseRelation.findMany({
          where: {
            sourceSenseId: {
              in: sourceSenses.map((sense) => sense.id),
            },
            relType: "antonym",
          },
          include: {
            targetSynset: {
              include: {
                senses: {
                  include: {
                    entry: true,
                  },
                },
              },
            },
          },
        });

  const antonymWords = uniqueByKey(
    antonymRelations.flatMap((relation) =>
      wordsFromSynset(relation.targetSynset),
    ),
    (word) => `${normalizeLemma(word.lemma)}|${word.partOfSpeech ?? ""}`,
  );

  const hypernymRelations = await prisma.wordnetRelation.findMany({
    where: {
      relType: "hypernym",
      OR: [
        {
          sourceSynsetId: {
            in: synsetIds,
          },
        },
        {
          targetSynsetId: {
            in: synsetIds,
          },
        },
      ],
    },
    include: {
      sourceSynset: {
        include: {
          senses: {
            include: {
              entry: true,
            },
          },
        },
      },
      targetSynset: {
        include: {
          senses: {
            include: {
              entry: true,
            },
          },
        },
      },
    },
  });

  const hypernymWords = uniqueByKey(
    hypernymRelations
      .filter((relation) => synsetIds.includes(relation.sourceSynsetId))
      .flatMap((relation) => wordsFromSynset(relation.targetSynset)),
    (word) => `${normalizeLemma(word.lemma)}|${word.partOfSpeech ?? ""}`,
  );
  const hyponymWords = uniqueByKey(
    hypernymRelations
      .filter((relation) => synsetIds.includes(relation.targetSynsetId))
      .flatMap((relation) => wordsFromSynset(relation.sourceSynset)),
    (word) => `${normalizeLemma(word.lemma)}|${word.partOfSpeech ?? ""}`,
  );

  const [
    synonyms,
    antonyms,
    hypernyms,
    hyponyms,
    importInfo,
  ] = await Promise.all([
    attachLexemeLinks(synonymWords),
    attachLexemeLinks(antonymWords),
    attachLexemeLinks(hypernymWords),
    attachLexemeLinks(hyponymWords),
    prisma.wordnetImport.findUnique({
      where: {
        id: "odenet-1.4",
      },
      select: {
        version: true,
        license: true,
        sourceUrl: true,
      },
    }),
  ]);

  return {
    definitions,
    examples,
    synonyms,
    antonyms,
    hypernyms,
    hyponyms,
    source: importInfo,
  };
}
