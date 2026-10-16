ALTER TABLE "user_lexemes"
  ADD COLUMN "is_favorite" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'NEW',
  ADD COLUMN "leitner_box" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "due_at" TIMESTAMPTZ(6),
  ADD COLUMN "interval_days" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "ease_factor" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
  ADD COLUMN "repetitions" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lapses" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "last_reviewed_at" TIMESTAMPTZ(6);

CREATE INDEX "user_lexemes_user_id_status_due_at_idx"
  ON "user_lexemes"("user_id", "status", "due_at");

CREATE TABLE "user_word_notes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "lexeme_id" UUID NOT NULL,
  "content" TEXT NOT NULL DEFAULT '',
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "user_word_notes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_word_notes_user_id_lexeme_id_key"
  ON "user_word_notes"("user_id", "lexeme_id");

CREATE INDEX "user_word_notes_user_id_updated_at_idx"
  ON "user_word_notes"("user_id", "updated_at" DESC);

ALTER TABLE "user_word_notes"
  ADD CONSTRAINT "user_word_notes_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "profiles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_word_notes"
  ADD CONSTRAINT "user_word_notes_lexeme_id_fkey"
  FOREIGN KEY ("lexeme_id") REFERENCES "lexemes"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_word_notes" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_word_notes_select_own"
  ON "user_word_notes"
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "user_word_notes_insert_own"
  ON "user_word_notes"
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_word_notes_update_own"
  ON "user_word_notes"
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE ON "user_word_notes" TO authenticated;
