import "server-only";

import { cacheLife, cacheTag } from "next/cache";
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

/** Relation groups render at most this many chips. */
const WORDS_PER_GROUP_LIMIT = 24;
/** Guard against words whose synset graph is enormous (common verbs). */
const RELATED_SYNSET_LIMIT = 80;

type WordnetWord = {
  lemma: string;
  partOfSpeech: string | null;
};

function wordKey(word: WordnetWord): string {
  return `${normalizeLemma(word.lemma)}|${word.partOfSpeech ?? ""}`;
}

/**
 * Resolves the internal `/words/[id]` links for every related word in a single
 * query instead of one query per relation group.
 */
async function attachLexemeLinks(
  groups: WordnetWord[][],
): Promise<WordnetRelatedWord[][]> {
  const normalizedLemmas = Array.from(
    new Set(groups.flat().map((word) => normalizeLemma(word.lemma))),
  ).filter(Boolean);
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

  return groups.map((group) =>
    group.map((word) => ({
      ...word,
      lexemeId: lexemeByLemma.get(normalizeLemma(word.lemma)) ?? null,
    })),
  );
}

/**
 * Uncached WordNet lookup: one flat query per table plus in-memory assembly, so
 * a lexical entry costs a handful of round trips instead of a deep include
 * chain. Exported for scripts and tests; application code should call
 * `getWordnetContentForLexeme` so the result is cached.
 */
export async function readWordnetContentForLexeme(lexeme: {
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

  const synsetIds = links
    .map((link) => link.synsetId)
    .sort((a, b) => a.localeCompare(b));

  const [
    synsets,
    definitionRows,
    exampleRows,
    relationRows,
    antonymRows,
    importInfo,
  ] = await Promise.all([
    prisma.wordnetSynset.findMany({
      where: { id: { in: synsetIds } },
      select: { id: true, descriptionEn: true },
    }),
    prisma.wordnetDefinition.findMany({
      where: { synsetId: { in: synsetIds } },
      select: { synsetId: true, language: true, text: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.wordnetExample.findMany({
      where: { synsetId: { in: synsetIds } },
      select: { text: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.wordnetRelation.findMany({
      where: {
        relType: "hypernym",
        OR: [
          { sourceSynsetId: { in: synsetIds } },
          { targetSynsetId: { in: synsetIds } },
        ],
      },
      select: { sourceSynsetId: true, targetSynsetId: true },
      orderBy: { targetSynsetId: "asc" },
    }),
    prisma.wordnetSenseRelation.findMany({
      where: {
        relType: "antonym",
        sourceSense: {
          synsetId: { in: synsetIds },
          entry: { normalizedLemma: lexeme.normalizedLemma },
        },
      },
      select: { targetSynsetId: true },
      orderBy: { targetSynsetId: "asc" },
      take: RELATED_SYNSET_LIMIT,
    }),
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

  const ownSynsetIds = new Set(synsetIds);
  const relatedSynsetIds = Array.from(
    new Set([
      ...relationRows
        .filter((relation) => ownSynsetIds.has(relation.sourceSynsetId))
        .map((relation) => relation.targetSynsetId),
      ...relationRows
        .filter((relation) => ownSynsetIds.has(relation.targetSynsetId))
        .map((relation) => relation.sourceSynsetId),
      ...antonymRows.map((relation) => relation.targetSynsetId),
    ]),
  ).slice(0, RELATED_SYNSET_LIMIT);

  const senses = await prisma.wordnetSense.findMany({
    where: {
      synsetId: { in: [...synsetIds, ...relatedSynsetIds] },
    },
    select: {
      synsetId: true,
      entry: {
        select: { lemma: true, partOfSpeech: true },
      },
    },
    orderBy: { id: "asc" },
  });

  const wordsBySynset = new Map<string, WordnetWord[]>();
  const seenBySynset = new Map<string, Set<string>>();

  for (const sense of senses) {
    const word: WordnetWord = {
      lemma: sense.entry.lemma,
      partOfSpeech: sense.entry.partOfSpeech,
    };
    const seen = seenBySynset.get(sense.synsetId) ?? new Set<string>();
    const key = wordKey(word);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    seenBySynset.set(sense.synsetId, seen);
    const words = wordsBySynset.get(sense.synsetId) ?? [];
    words.push(word);
    wordsBySynset.set(sense.synsetId, words);
  }

  const definitionsById = new Map<string, Array<{ language: string; text: string }>>();

  for (const definition of definitionRows) {
    const list = definitionsById.get(definition.synsetId) ?? [];
    list.push({ language: definition.language, text: definition.text });
    definitionsById.set(definition.synsetId, list);
  }

  const descriptionById = new Map(
    synsets.map((synset) => [synset.id, synset.descriptionEn]),
  );
  const definitions = uniqueByKey(
    synsetIds.flatMap((synsetId) => [
      ...(definitionsById.get(synsetId) ?? []),
      ...(descriptionById.get(synsetId)
        ? [{ language: "en", text: descriptionById.get(synsetId)! }]
        : []),
    ]),
    (definition) => `${definition.language}|${definition.text}`,
  );

  const examples = Array.from(new Set(exampleRows.map((row) => row.text)));

  const ownNormalizedLemma = normalizeLemma(lexeme.canonicalLemma);
  const wordsOf = (synsetIdsToRead: readonly string[]): WordnetWord[] =>
    uniqueByKey(
      synsetIdsToRead.flatMap((synsetId) => wordsBySynset.get(synsetId) ?? []),
      wordKey,
    );

  const synonymWords = wordsOf(synsetIds)
    .filter((word) => normalizeLemma(word.lemma) !== ownNormalizedLemma)
    .slice(0, WORDS_PER_GROUP_LIMIT);
  const antonymWords = wordsOf(
    Array.from(new Set(antonymRows.map((row) => row.targetSynsetId))),
  ).slice(0, WORDS_PER_GROUP_LIMIT);
  const hypernymWords = wordsOf(
    Array.from(
      new Set(
        relationRows
          .filter((relation) => ownSynsetIds.has(relation.sourceSynsetId))
          .map((relation) => relation.targetSynsetId),
      ),
    ),
  ).slice(0, WORDS_PER_GROUP_LIMIT);
  const hyponymWords = wordsOf(
    Array.from(
      new Set(
        relationRows
          .filter((relation) => ownSynsetIds.has(relation.targetSynsetId))
          .map((relation) => relation.sourceSynsetId),
      ),
    ),
  ).slice(0, WORDS_PER_GROUP_LIMIT);

  const [synonyms, antonyms, hypernyms, hyponyms] = await attachLexemeLinks([
    synonymWords,
    antonymWords,
    hypernymWords,
    hyponymWords,
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

/**
 * WordNet content for a lexical entry. OdeNet data only changes when it is
 * re-imported, so the assembled content is cached across requests and users.
 */
export async function getWordnetContentForLexeme(lexeme: {
  id: string;
  canonicalLemma: string;
  normalizedLemma: string;
}): Promise<WordnetContent | null> {
  "use cache";
  cacheLife("days");
  cacheTag("wordnet");

  return readWordnetContentForLexeme(lexeme);
}
