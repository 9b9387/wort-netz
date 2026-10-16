CREATE TABLE "articles" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "content" TEXT NOT NULL DEFAULT '',
  "excerpt" TEXT NOT NULL DEFAULT '',
  "char_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "articles_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "articles_user_id_updated_at_idx"
  ON "articles"("user_id", "updated_at" DESC);

ALTER TABLE "articles"
  ADD CONSTRAINT "articles_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "profiles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "articles" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "articles_select_own"
  ON "articles"
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "articles_insert_own"
  ON "articles"
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "articles_update_own"
  ON "articles"
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "articles_delete_own"
  ON "articles"
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON "articles" TO authenticated;
