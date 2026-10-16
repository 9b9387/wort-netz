ALTER TABLE "profiles"
  ADD COLUMN "review_session_size" INTEGER NOT NULL DEFAULT 20,
  ADD COLUMN "review_new_per_day" INTEGER NOT NULL DEFAULT 20,
  ADD COLUMN "review_tz_offset_minutes" INTEGER NOT NULL DEFAULT -480;

CREATE TABLE "review_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "lexeme_id" UUID NOT NULL,
  "session_id" UUID NOT NULL,
  "client_card_id" UUID NOT NULL,
  "rating" TEXT NOT NULL,
  "box_before" INTEGER NOT NULL,
  "box_after" INTEGER NOT NULL,
  "interval_days_after" INTEGER NOT NULL,
  "due_at_after" TIMESTAMPTZ(6),
  "elapsed_ms" INTEGER,
  "tz_offset_minutes" INTEGER NOT NULL,
  "reviewed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "review_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "review_logs_session_id_client_card_id_key"
  ON "review_logs"("session_id", "client_card_id");

CREATE INDEX "review_logs_user_id_reviewed_at_idx"
  ON "review_logs"("user_id", "reviewed_at" DESC);

CREATE INDEX "review_logs_user_id_lexeme_id_reviewed_at_idx"
  ON "review_logs"("user_id", "lexeme_id", "reviewed_at" DESC);

ALTER TABLE "review_logs"
  ADD CONSTRAINT "review_logs_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "profiles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "review_logs"
  ADD CONSTRAINT "review_logs_lexeme_id_fkey"
  FOREIGN KEY ("lexeme_id") REFERENCES "lexemes"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "review_logs" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_logs_select_own"
  ON "review_logs"
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "review_logs_insert_own"
  ON "review_logs"
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- The log is append-only: no update or delete policy, and no DELETE grant.
GRANT SELECT, INSERT ON "review_logs" TO authenticated;

CREATE TABLE "ai_review_sentences" (
  "user_id" UUID NOT NULL,
  "lexeme_id" UUID NOT NULL,
  "sentence" TEXT NOT NULL,
  "translation" TEXT NOT NULL,
  "highlight_form" TEXT NOT NULL,
  "config_hash" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ai_review_sentences_pkey" PRIMARY KEY ("user_id", "lexeme_id")
);

ALTER TABLE "ai_review_sentences"
  ADD CONSTRAINT "ai_review_sentences_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "profiles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_review_sentences"
  ADD CONSTRAINT "ai_review_sentences_lexeme_id_fkey"
  FOREIGN KEY ("lexeme_id") REFERENCES "lexemes"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_review_sentences" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_review_sentences_select_own"
  ON "ai_review_sentences"
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "ai_review_sentences_insert_own"
  ON "ai_review_sentences"
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ai_review_sentences_update_own"
  ON "ai_review_sentences"
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE ON "ai_review_sentences" TO authenticated;
