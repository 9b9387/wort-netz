CREATE TABLE "vocabulary_levels" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "level" TEXT NOT NULL,
  "lemma" TEXT NOT NULL,
  "normalized_lemma" TEXT NOT NULL,
  "part_of_speech" TEXT NOT NULL DEFAULT '',
  "translation_en" TEXT,
  "example_de" TEXT,
  "source" TEXT NOT NULL DEFAULT 'wordfeather',
  "source_url" TEXT NOT NULL,
  "license" TEXT NOT NULL,
  "confidence" DOUBLE PRECISION,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "vocabulary_levels_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "vocabulary_levels_normalized_lemma_level_part_of_speech_key"
  ON "vocabulary_levels"("normalized_lemma", "level", "part_of_speech");
CREATE INDEX "vocabulary_levels_normalized_lemma_idx"
  ON "vocabulary_levels"("normalized_lemma");
CREATE INDEX "vocabulary_levels_level_idx"
  ON "vocabulary_levels"("level");

CREATE TABLE "lexeme_vocabulary_levels" (
  "lexeme_id" UUID NOT NULL,
  "level" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'wordfeather',
  "confidence" DOUBLE PRECISION,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lexeme_vocabulary_levels_pkey" PRIMARY KEY ("lexeme_id", "level")
);

CREATE INDEX "lexeme_vocabulary_levels_level_idx"
  ON "lexeme_vocabulary_levels"("level");

ALTER TABLE "lexeme_vocabulary_levels"
  ADD CONSTRAINT "lexeme_vocabulary_levels_lexeme_id_fkey"
  FOREIGN KEY ("lexeme_id") REFERENCES "lexemes"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "vocabulary_levels" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lexeme_vocabulary_levels" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vocabulary_levels_select_authenticated"
  ON "vocabulary_levels" FOR SELECT TO authenticated USING (true);
CREATE POLICY "lexeme_vocabulary_levels_select_authenticated"
  ON "lexeme_vocabulary_levels" FOR SELECT TO authenticated USING (true);

GRANT SELECT ON "vocabulary_levels" TO authenticated;
GRANT SELECT ON "lexeme_vocabulary_levels" TO authenticated;
