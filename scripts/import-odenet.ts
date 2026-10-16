import { config } from "dotenv";
import { readFile } from "node:fs/promises";
import { PrismaPg } from "@prisma/adapter-pg";
import { XMLParser } from "fast-xml-parser";
import { PrismaClient } from "../lib/generated/prisma/client";

config({ path: ".env.local" });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is not configured");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: DATABASE_URL }),
});

const XML_PATH =
  process.env.ODENET_XML_PATH ??
  "data/odenet/odenet-1.4/deWordNet.xml";
const ODENET_VERSION = "1.4";
const ODENET_SOURCE_URL =
  "https://github.com/hdaSprachtechnologie/odenet/releases/tag/v1.4";
const ODENET_LICENSE = "CC BY-SA 4.0";
const BATCH_SIZE = 1000;

type UnknownRecord = Record<string, unknown>;

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" ? (value as UnknownRecord) : {};
}

function textOf(value: unknown): string | null {
  if (typeof value === "string") {
    return value.trim() || null;
  }

  const record = asRecord(value);
  const text = record["#text"];

  return typeof text === "string" ? text.trim() || null : null;
}

function attribute(
  record: UnknownRecord,
  name: string,
): string | null {
  const value = record[name];
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : null;
}

function normalizeLemma(value: string): string {
  return value.normalize("NFC").trim().toLowerCase();
}

function wordnetPosFromDwds(wordType: string | null): string | null {
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

async function insertInBatches<T>(
  rows: T[],
  insert: (batch: T[]) => Promise<unknown>,
  label: string,
) {
  for (let index = 0; index < rows.length; index += BATCH_SIZE) {
    const batch = rows.slice(index, index + BATCH_SIZE);
    await insert(batch);

    if (index % (BATCH_SIZE * 10) === 0) {
      console.log(`${label}: ${Math.min(index + batch.length, rows.length)}/${rows.length}`);
    }
  }
}

async function main() {
  console.log(`Reading OdeNet XML: ${XML_PATH}`);
  const xml = await readFile(XML_PATH, "utf8");

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    parseAttributeValue: false,
    trimValues: true,
    isArray: (name) =>
      [
        "LexicalEntry",
        "Synset",
        "Sense",
        "Definition",
        "Example",
        "SynsetRelation",
        "SenseRelation",
      ].includes(name),
  });

  const parsed = parser.parse(xml) as UnknownRecord;
  const lexicalResource = asRecord(parsed.LexicalResource);
  const lexicon = asRecord(lexicalResource.Lexicon);
  const lexicalEntryNodes = asArray(lexicon.LexicalEntry).map(asRecord);
  const synsetNodes = asArray(lexicon.Synset).map(asRecord);

  console.log(
    `Parsed ${lexicalEntryNodes.length} entries and ${synsetNodes.length} synsets`,
  );

  const synsets = synsetNodes
    .map((synset) => {
      const id = attribute(synset, "@_id");

      if (!id) {
        return null;
      }

      return {
        id,
        ili: attribute(synset, "@_ili"),
        partOfSpeech: attribute(synset, "@_partOfSpeech"),
        descriptionEn: attribute(synset, "@_dc:description"),
        subject: attribute(synset, "@_dc:subject"),
      };
    })
    .filter((synset): synset is NonNullable<typeof synset> => Boolean(synset));

  const synsetIds = new Set(synsets.map((synset) => synset.id));

  const entries = lexicalEntryNodes
    .map((entry) => {
      const id = attribute(entry, "@_id");
      const lemmaNode = asArray(entry.Lemma).map(asRecord)[0] ?? {};
      const lemma = attribute(lemmaNode, "@_writtenForm");

      if (!id || !lemma) {
        return null;
      }

      const confidenceScore = attribute(entry, "@_confidenceScore");

      return {
        id,
        lemma,
        normalizedLemma: normalizeLemma(lemma),
        partOfSpeech: attribute(lemmaNode, "@_partOfSpeech"),
        basicVocabulary: attribute(entry, "@_dc:type") === "Basiswortschatz",
        confidenceScore: confidenceScore ? Number(confidenceScore) : null,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  const entryIds = new Set(entries.map((entry) => entry.id));

  const definitions: Array<{
    synsetId: string;
    language: string;
    text: string;
  }> = [];
  const examples: Array<{ synsetId: string; text: string }> = [];
  const relations: Array<{
    sourceSynsetId: string;
    targetSynsetId: string;
    relType: string;
  }> = [];

  for (const synset of synsetNodes) {
    const synsetId = attribute(synset, "@_id");

    if (!synsetId) {
      continue;
    }

    for (const definition of asArray(synset.Definition)) {
      const text = textOf(definition);

      if (text) {
        definitions.push({ synsetId, language: "de", text });
      }
    }

    for (const example of asArray(synset.Example)) {
      const text = textOf(example);

      if (text) {
        examples.push({ synsetId, text });
      }
    }

    for (const relation of asArray(synset.SynsetRelation).map(asRecord)) {
      const targetSynsetId = attribute(relation, "@_target");
      const relType = attribute(relation, "@_relType");

      if (targetSynsetId && relType && synsetIds.has(targetSynsetId)) {
        relations.push({ sourceSynsetId: synsetId, targetSynsetId, relType });
      }
    }
  }

  const senses: Array<{
    id: string;
    entryId: string;
    synsetId: string;
  }> = [];
  const senseRelations: Array<{
    sourceSenseId: string;
    targetSynsetId: string;
    relType: string;
  }> = [];

  for (const entry of lexicalEntryNodes) {
    const entryId = attribute(entry, "@_id");

    if (!entryId || !entryIds.has(entryId)) {
      continue;
    }

    for (const sense of asArray(entry.Sense).map(asRecord)) {
      const senseId = attribute(sense, "@_id");
      const synsetId = attribute(sense, "@_synset");

      if (!senseId || !synsetId || !synsetIds.has(synsetId)) {
        continue;
      }

      senses.push({ id: senseId, entryId, synsetId });

      for (const relation of asArray(sense.SenseRelation).map(asRecord)) {
        const targetSynsetId = attribute(relation, "@_target");
        const relType = attribute(relation, "@_relType");

        if (targetSynsetId && relType && synsetIds.has(targetSynsetId)) {
          senseRelations.push({
            sourceSenseId: senseId,
            targetSynsetId,
            relType,
          });
        }
      }
    }
  }

  const uniqueRelations = Array.from(
    new Map(
      relations.map((relation) => [
        `${relation.sourceSynsetId}|${relation.targetSynsetId}|${relation.relType}`,
        relation,
      ]),
    ).values(),
  );
  const uniqueSenseRelations = Array.from(
    new Map(
      senseRelations.map((relation) => [
        `${relation.sourceSenseId}|${relation.targetSynsetId}|${relation.relType}`,
        relation,
      ]),
    ).values(),
  );
  const uniqueDefinitions = Array.from(
    new Map(
      definitions.map((definition) => [
        `${definition.synsetId}|${definition.language}|${definition.text}`,
        definition,
      ]),
    ).values(),
  );

  console.log(
    `Prepared ${entries.length} entries, ${senses.length} senses, ` +
      `${uniqueDefinitions.length} definitions, ${examples.length} examples, ` +
      `${uniqueRelations.length} synset relations, ` +
      `${uniqueSenseRelations.length} sense relations`,
  );

  console.log("Clearing previous OdeNet import");
  await prisma.wordnetSenseRelation.deleteMany();
  await prisma.wordnetRelation.deleteMany();
  await prisma.wordnetExample.deleteMany();
  await prisma.wordnetDefinition.deleteMany();
  await prisma.wordnetSense.deleteMany();
  await prisma.lexemeSynset.deleteMany();
  await prisma.wordnetLexicalEntry.deleteMany();
  await prisma.wordnetSynset.deleteMany();

  await insertInBatches(
    synsets,
    (batch) => prisma.wordnetSynset.createMany({ data: batch }),
    "synsets",
  );
  await insertInBatches(
    entries,
    (batch) => prisma.wordnetLexicalEntry.createMany({ data: batch }),
    "lexical entries",
  );
  await insertInBatches(
    uniqueDefinitions,
    (batch) => prisma.wordnetDefinition.createMany({ data: batch }),
    "definitions",
  );
  await insertInBatches(
    examples,
    (batch) => prisma.wordnetExample.createMany({ data: batch }),
    "examples",
  );
  await insertInBatches(
    senses,
    (batch) => prisma.wordnetSense.createMany({ data: batch }),
    "senses",
  );
  await insertInBatches(
    uniqueRelations,
    (batch) => prisma.wordnetRelation.createMany({ data: batch }),
    "synset relations",
  );
  await insertInBatches(
    uniqueSenseRelations,
    (batch) => prisma.wordnetSenseRelation.createMany({ data: batch }),
    "sense relations",
  );

  await prisma.wordnetImport.upsert({
    where: { id: `odenet-${ODENET_VERSION}` },
    update: {
      version: ODENET_VERSION,
      sourceUrl: ODENET_SOURCE_URL,
      license: ODENET_LICENSE,
      importedAt: new Date(),
      statsJson: {
        synsets: synsets.length,
        lexicalEntries: entries.length,
        senses: senses.length,
        definitions: uniqueDefinitions.length,
        examples: examples.length,
        synsetRelations: uniqueRelations.length,
        senseRelations: uniqueSenseRelations.length,
      },
    },
    create: {
      id: `odenet-${ODENET_VERSION}`,
      version: ODENET_VERSION,
      sourceUrl: ODENET_SOURCE_URL,
      license: ODENET_LICENSE,
      statsJson: {
        synsets: synsets.length,
        lexicalEntries: entries.length,
        senses: senses.length,
        definitions: uniqueDefinitions.length,
        examples: examples.length,
        synsetRelations: uniqueRelations.length,
        senseRelations: uniqueSenseRelations.length,
      },
    },
  });

  console.log("Rebuilding lexeme -> synset links");
  const lexemes = await prisma.lexeme.findMany({
    select: {
      id: true,
      normalizedLemma: true,
      wordType: true,
    },
  });

  let linkedLexemes = 0;

  for (const lexeme of lexemes) {
    const partOfSpeech = wordnetPosFromDwds(lexeme.wordType);
    let entriesForLexeme = await prisma.wordnetLexicalEntry.findMany({
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

    if (entriesForLexeme.length === 0 && partOfSpeech) {
      entriesForLexeme = await prisma.wordnetLexicalEntry.findMany({
        where: { normalizedLemma: lexeme.normalizedLemma },
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

    const synsetsForLexeme = Array.from(
      new Set(
        entriesForLexeme.flatMap((entry) =>
          entry.senses.map((sense) => sense.synsetId),
        ),
      ),
    );

    if (synsetsForLexeme.length > 0) {
      linkedLexemes += 1;
      await prisma.lexemeSynset.createMany({
        data: synsetsForLexeme.map((synsetId) => ({
          lexemeId: lexeme.id,
          synsetId,
          matchType,
          confidence: matchType === "lemma_pos" ? 1 : 0.7,
        })),
        skipDuplicates: true,
      });
    }
  }

  console.log(
    `Linked ${linkedLexemes}/${lexemes.length} existing lexemes to OdeNet synsets`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
