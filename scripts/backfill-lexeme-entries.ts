/**
 * Re-resolves stored lexemes from DWDS and the English dictionary.
 *
 * Entries created before the snippet selection understood morphology can point
 * at the wrong DWDS reading: "willst" was filed as the adjective "wollen"
 * (wool) instead of the verb, which also gave the entry adjective forms, a
 * one-sense English definition and an unrelated WordNet synset.
 *
 * Usage:
 *   npm run db:backfill:lexemes              # lemmas DWDS returns several readings for
 *   npm run db:backfill:lexemes -- --all     # every lexeme
 *   npm run db:backfill:lexemes -- --dry-run # report only, write nothing
 */

import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

type Row = {
  id: string;
  canonical_lemma: string;
};

async function main() {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has("--dry-run");
  const all = args.has("--all");
  const { prisma } = await import("../lib/prisma");
  const { refreshLexemeEntry } = await import("../lib/server/lexemes");

  const rows = all
    ? await prisma.$queryRaw<Row[]>`
        select id, canonical_lemma from lexemes order by canonical_lemma`
    : await prisma.$queryRaw<Row[]>`
        select id, canonical_lemma
        from lexemes
        where jsonb_typeof(source_json->'snippet') = 'array'
          and jsonb_array_length(source_json->'snippet') > 1
        order by canonical_lemma`;

  console.log(
    `${rows.length} lexeme(s) to check${dryRun ? " (dry run)" : ""}`,
  );

  let changed = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const report = await refreshLexemeEntry({
        lexemeId: row.id,
        dryRun,
      });

      if (!report || report.skipped) {
        skipped += 1;
        console.log(`- ${row.canonical_lemma}: skipped (${report?.skipped})`);
        continue;
      }

      if (!report.changed) {
        console.log(`- ${row.canonical_lemma}: unchanged`);
        continue;
      }

      changed += 1;
      console.log(
        [
          `- ${report.lemma} (from "${report.surface}")`,
          `  wordType: ${report.before.wordType} -> ${report.after.wordType}`,
          `  senses:   ${report.before.senseCount} -> ${report.after.senseCount}`,
          `  meaning:  ${report.before.definitionEn ?? "—"} -> ${
            report.after.definitionEn ?? "—"
          }`,
        ].join("\n"),
      );
    } catch (error) {
      failed += 1;
      console.error(
        `- ${row.canonical_lemma}: failed (${
          error instanceof Error ? error.message : String(error)
        })`,
      );
    }
  }

  console.log(
    `done: ${changed} changed, ${skipped} skipped, ${failed} failed${
      dryRun ? ", nothing written" : ""
    }`,
  );

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
