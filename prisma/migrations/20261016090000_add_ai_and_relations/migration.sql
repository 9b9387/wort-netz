ALTER TABLE "user_word_notes"
  ADD COLUMN "ai_intro_content" TEXT,
  ADD COLUMN "ai_intro_config_hash" TEXT,
  ADD COLUMN "ai_intro_generated_at" TIMESTAMPTZ(6);

CREATE TABLE "user_llm_configs" (
  "user_id" UUID NOT NULL,
  "base_url" TEXT NOT NULL,
  "api_key_ciphertext" JSONB NOT NULL,
  "model" TEXT NOT NULL,
  "temperature" DOUBLE PRECISION,
  "max_tokens" INTEGER,
  "timeout_ms" INTEGER,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "user_llm_configs_pkey" PRIMARY KEY ("user_id")
);

CREATE TABLE "ai_threads" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "lexeme_id" UUID,
  "kind" TEXT NOT NULL DEFAULT 'general',
  "title" TEXT,
  "last_message_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ai_threads_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_threads_user_id_last_message_at_idx"
  ON "ai_threads"("user_id", "last_message_at" DESC);
CREATE INDEX "ai_threads_lexeme_id_idx" ON "ai_threads"("lexeme_id");

CREATE TABLE "ai_messages" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "thread_id" UUID NOT NULL,
  "role" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "model" TEXT,
  "config_hash" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_messages_thread_id_created_at_idx"
  ON "ai_messages"("thread_id", "created_at");
CREATE INDEX "ai_messages_user_id_created_at_idx"
  ON "ai_messages"("user_id", "created_at" DESC);

CREATE TABLE "lexeme_relations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "source_lexeme_id" UUID NOT NULL,
  "target_lexeme_id" UUID,
  "target_lemma" TEXT NOT NULL,
  "target_normalized_lemma" TEXT NOT NULL,
  "relation_type" TEXT NOT NULL DEFAULT 'synonym',
  "source_name" TEXT NOT NULL DEFAULT 'openthesaurus',
  "source_data" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "lexeme_relations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "lexeme_relations_source_target_type_source_key"
  ON "lexeme_relations"(
    "source_lexeme_id",
    "target_normalized_lemma",
    "relation_type",
    "source_name"
  );
CREATE INDEX "lexeme_relations_source_lexeme_id_relation_type_idx"
  ON "lexeme_relations"("source_lexeme_id", "relation_type");
CREATE INDEX "lexeme_relations_target_lexeme_id_relation_type_idx"
  ON "lexeme_relations"("target_lexeme_id", "relation_type");

ALTER TABLE "user_llm_configs"
  ADD CONSTRAINT "user_llm_configs_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "profiles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_threads"
  ADD CONSTRAINT "ai_threads_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "profiles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_threads"
  ADD CONSTRAINT "ai_threads_lexeme_id_fkey"
  FOREIGN KEY ("lexeme_id") REFERENCES "lexemes"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ai_messages"
  ADD CONSTRAINT "ai_messages_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "profiles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_messages"
  ADD CONSTRAINT "ai_messages_thread_id_fkey"
  FOREIGN KEY ("thread_id") REFERENCES "ai_threads"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lexeme_relations"
  ADD CONSTRAINT "lexeme_relations_source_lexeme_id_fkey"
  FOREIGN KEY ("source_lexeme_id") REFERENCES "lexemes"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lexeme_relations"
  ADD CONSTRAINT "lexeme_relations_target_lexeme_id_fkey"
  FOREIGN KEY ("target_lexeme_id") REFERENCES "lexemes"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- User LLM configuration contains an encrypted API key and is intentionally
-- not exposed through PostgREST. Prisma's owner role is the only access path.
ALTER TABLE "user_llm_configs" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "ai_threads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lexeme_relations" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_threads_select_own"
  ON "ai_threads" FOR SELECT TO authenticated
  USING ((select auth.uid()) = "user_id");
CREATE POLICY "ai_threads_insert_own"
  ON "ai_threads" FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = "user_id");
CREATE POLICY "ai_threads_update_own"
  ON "ai_threads" FOR UPDATE TO authenticated
  USING ((select auth.uid()) = "user_id")
  WITH CHECK ((select auth.uid()) = "user_id");
CREATE POLICY "ai_threads_delete_own"
  ON "ai_threads" FOR DELETE TO authenticated
  USING ((select auth.uid()) = "user_id");

CREATE POLICY "ai_messages_select_own"
  ON "ai_messages" FOR SELECT TO authenticated
  USING ((select auth.uid()) = "user_id");
CREATE POLICY "ai_messages_insert_own"
  ON "ai_messages" FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = "user_id");
CREATE POLICY "ai_messages_delete_own"
  ON "ai_messages" FOR DELETE TO authenticated
  USING ((select auth.uid()) = "user_id");

CREATE POLICY "lexeme_relations_select_authenticated"
  ON "lexeme_relations" FOR SELECT TO authenticated
  USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON "ai_threads" TO authenticated;
GRANT SELECT, INSERT, DELETE ON "ai_messages" TO authenticated;
GRANT SELECT ON "lexeme_relations" TO authenticated;
