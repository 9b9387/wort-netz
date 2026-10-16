CREATE TABLE "wordnet_synsets" (
  "id" TEXT NOT NULL,
  "ili" TEXT,
  "part_of_speech" TEXT,
  "description_en" TEXT,
  "subject" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "wordnet_synsets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "wordnet_synsets_part_of_speech_idx"
  ON "wordnet_synsets"("part_of_speech");
CREATE INDEX "wordnet_synsets_ili_idx"
  ON "wordnet_synsets"("ili");

CREATE TABLE "wordnet_definitions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "synset_id" TEXT NOT NULL,
  "language" TEXT NOT NULL DEFAULT 'de',
  "text" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "wordnet_definitions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "wordnet_definitions_synset_id_idx"
  ON "wordnet_definitions"("synset_id");

CREATE TABLE "wordnet_examples" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "synset_id" TEXT,
  "text" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "wordnet_examples_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "wordnet_examples_synset_id_idx"
  ON "wordnet_examples"("synset_id");

CREATE TABLE "wordnet_lexical_entries" (
  "id" TEXT NOT NULL,
  "lemma" TEXT NOT NULL,
  "normalized_lemma" TEXT NOT NULL,
  "part_of_speech" TEXT,
  "basic_vocabulary" BOOLEAN NOT NULL DEFAULT false,
  "confidence_score" DOUBLE PRECISION,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "wordnet_lexical_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "wordnet_lexical_entries_normalized_lemma_part_of_speech_idx"
  ON "wordnet_lexical_entries"("normalized_lemma", "part_of_speech");

CREATE TABLE "wordnet_senses" (
  "id" TEXT NOT NULL,
  "entry_id" TEXT NOT NULL,
  "synset_id" TEXT NOT NULL,
  CONSTRAINT "wordnet_senses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "wordnet_senses_synset_id_idx"
  ON "wordnet_senses"("synset_id");
CREATE INDEX "wordnet_senses_entry_id_idx"
  ON "wordnet_senses"("entry_id");

CREATE TABLE "wordnet_relations" (
  "source_synset_id" TEXT NOT NULL,
  "target_synset_id" TEXT NOT NULL,
  "rel_type" TEXT NOT NULL,
  CONSTRAINT "wordnet_relations_pkey"
    PRIMARY KEY ("source_synset_id", "target_synset_id", "rel_type")
);

CREATE INDEX "wordnet_relations_source_synset_id_rel_type_idx"
  ON "wordnet_relations"("source_synset_id", "rel_type");
CREATE INDEX "wordnet_relations_target_synset_id_rel_type_idx"
  ON "wordnet_relations"("target_synset_id", "rel_type");

CREATE TABLE "wordnet_sense_relations" (
  "source_sense_id" TEXT NOT NULL,
  "target_synset_id" TEXT NOT NULL,
  "rel_type" TEXT NOT NULL,
  CONSTRAINT "wordnet_sense_relations_pkey"
    PRIMARY KEY ("source_sense_id", "target_synset_id", "rel_type")
);

CREATE INDEX "wordnet_sense_relations_source_sense_id_rel_type_idx"
  ON "wordnet_sense_relations"("source_sense_id", "rel_type");
CREATE INDEX "wordnet_sense_relations_target_synset_id_rel_type_idx"
  ON "wordnet_sense_relations"("target_synset_id", "rel_type");

CREATE TABLE "lexeme_synsets" (
  "lexeme_id" UUID NOT NULL,
  "synset_id" TEXT NOT NULL,
  "match_type" TEXT NOT NULL DEFAULT 'exact',
  "confidence" DOUBLE PRECISION,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lexeme_synsets_pkey" PRIMARY KEY ("lexeme_id", "synset_id")
);

CREATE INDEX "lexeme_synsets_synset_id_idx"
  ON "lexeme_synsets"("synset_id");

CREATE TABLE "wordnet_imports" (
  "id" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "source_url" TEXT NOT NULL,
  "license" TEXT NOT NULL,
  "imported_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "stats_json" JSONB,
  CONSTRAINT "wordnet_imports_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "wordnet_definitions"
  ADD CONSTRAINT "wordnet_definitions_synset_id_fkey"
  FOREIGN KEY ("synset_id") REFERENCES "wordnet_synsets"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wordnet_examples"
  ADD CONSTRAINT "wordnet_examples_synset_id_fkey"
  FOREIGN KEY ("synset_id") REFERENCES "wordnet_synsets"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wordnet_senses"
  ADD CONSTRAINT "wordnet_senses_entry_id_fkey"
  FOREIGN KEY ("entry_id") REFERENCES "wordnet_lexical_entries"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wordnet_senses"
  ADD CONSTRAINT "wordnet_senses_synset_id_fkey"
  FOREIGN KEY ("synset_id") REFERENCES "wordnet_synsets"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wordnet_relations"
  ADD CONSTRAINT "wordnet_relations_source_synset_id_fkey"
  FOREIGN KEY ("source_synset_id") REFERENCES "wordnet_synsets"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wordnet_relations"
  ADD CONSTRAINT "wordnet_relations_target_synset_id_fkey"
  FOREIGN KEY ("target_synset_id") REFERENCES "wordnet_synsets"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wordnet_sense_relations"
  ADD CONSTRAINT "wordnet_sense_relations_source_sense_id_fkey"
  FOREIGN KEY ("source_sense_id") REFERENCES "wordnet_senses"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wordnet_sense_relations"
  ADD CONSTRAINT "wordnet_sense_relations_target_synset_id_fkey"
  FOREIGN KEY ("target_synset_id") REFERENCES "wordnet_synsets"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lexeme_synsets"
  ADD CONSTRAINT "lexeme_synsets_lexeme_id_fkey"
  FOREIGN KEY ("lexeme_id") REFERENCES "lexemes"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lexeme_synsets"
  ADD CONSTRAINT "lexeme_synsets_synset_id_fkey"
  FOREIGN KEY ("synset_id") REFERENCES "wordnet_synsets"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Global read-only WordNet data is available to authenticated PostgREST
-- clients. Prisma uses the database owner role for server-side queries.
ALTER TABLE "wordnet_synsets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "wordnet_definitions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "wordnet_examples" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "wordnet_lexical_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "wordnet_senses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "wordnet_relations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "wordnet_sense_relations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lexeme_synsets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "wordnet_imports" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wordnet_synsets_select_authenticated"
  ON "wordnet_synsets" FOR SELECT TO authenticated USING (true);
CREATE POLICY "wordnet_definitions_select_authenticated"
  ON "wordnet_definitions" FOR SELECT TO authenticated USING (true);
CREATE POLICY "wordnet_examples_select_authenticated"
  ON "wordnet_examples" FOR SELECT TO authenticated USING (true);
CREATE POLICY "wordnet_lexical_entries_select_authenticated"
  ON "wordnet_lexical_entries" FOR SELECT TO authenticated USING (true);
CREATE POLICY "wordnet_senses_select_authenticated"
  ON "wordnet_senses" FOR SELECT TO authenticated USING (true);
CREATE POLICY "wordnet_relations_select_authenticated"
  ON "wordnet_relations" FOR SELECT TO authenticated USING (true);
CREATE POLICY "wordnet_sense_relations_select_authenticated"
  ON "wordnet_sense_relations" FOR SELECT TO authenticated USING (true);
CREATE POLICY "lexeme_synsets_select_authenticated"
  ON "lexeme_synsets" FOR SELECT TO authenticated USING (true);
CREATE POLICY "wordnet_imports_select_authenticated"
  ON "wordnet_imports" FOR SELECT TO authenticated USING (true);

GRANT SELECT ON "wordnet_synsets" TO authenticated;
GRANT SELECT ON "wordnet_definitions" TO authenticated;
GRANT SELECT ON "wordnet_examples" TO authenticated;
GRANT SELECT ON "wordnet_lexical_entries" TO authenticated;
GRANT SELECT ON "wordnet_senses" TO authenticated;
GRANT SELECT ON "wordnet_relations" TO authenticated;
GRANT SELECT ON "wordnet_sense_relations" TO authenticated;
GRANT SELECT ON "lexeme_synsets" TO authenticated;
GRANT SELECT ON "wordnet_imports" TO authenticated;
