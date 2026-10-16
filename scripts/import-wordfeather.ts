import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { parseWordfeatherVocabulary } from "../lib/server/wordfeather-parser";

config({ path: ".env.local" });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is not configured");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: DATABASE_URL }),
});

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
const BATCH_SIZE = 1000;

async function insertInBatches<T>(
  rows: T[],
  insert: (batch: T[]) => Promise<unknown>,
  label: string,
) {
  for (let index = 0; index < rows.length; index += BATCH_SIZE) {
    const batch = rows.slice(index, index + BATCH_SIZE);
    await insert(batch);
    console.log(`${label}: ${Math.min(index + batch.length, rows.length)}/${rows.length}`);
  }
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

async function main() {
  const entries = [];

  for (const level of LEVELS) {
    const sourceUrl =
      `https://raw.githubusercontent.com/abdullahbutt/wordfeather/main/${level}/01_Wortschatz.html`;
    console.log(`Downloading ${level}: ${sourceUrl}`);
    const response = await fetch(sourceUrl);

    if (!response.ok) {
      throw new Error(`Failed to download ${sourceUrl}: ${response.status}`);
    }

    const html = await response.text();
    const parsed = parseWordfeatherVocabulary(html, level, sourceUrl);
    console.log(`${level}: ${parsed.length} entries`);
    entries.push(...parsed);
  }

  console.log(`Prepared ${entries.length} total vocabulary level entries`);
  console.log("Clearing previous vocabulary level import");
  await prisma.lexemeVocabularyLevel.deleteMany();
  await prisma.vocabularyLevel.deleteMany();

  await insertInBatches(
    entries,
    (batch) => prisma.vocabularyLevel.createMany({ data: batch }),
    "vocabulary levels",
  );

  console.log("Matching existing lexemes to vocabulary levels");
  const lexemes = await prisma.lexeme.findMany({
    select: {
      id: true,
      normalizedLemma: true,
      wordType: true,
    },
  });

  let linkedLexemes = 0;

  for (const lexeme of lexemes) {
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
    const byLevel = new Map<
      string,
      { source: string; confidence: number | null }
    >();

    for (const match of matches) {
      const current = byLevel.get(match.level);

      if (
        !current ||
        (match.confidence ?? 0) > (current.confidence ?? 0)
      ) {
        byLevel.set(match.level, {
          source: match.source,
          confidence: match.confidence,
        });
      }
    }

    if (byLevel.size > 0) {
      linkedLexemes += 1;
      await prisma.lexemeVocabularyLevel.createMany({
        data: Array.from(byLevel.entries()).map(([level, value]) => ({
          lexemeId: lexeme.id,
          level,
          source: value.source,
          confidence: value.confidence,
        })),
        skipDuplicates: true,
      });
    }
  }

  console.log(
    `Linked ${linkedLexemes}/${lexemes.length} existing lexemes to vocabulary levels`,
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
