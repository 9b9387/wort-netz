CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL,
    "display_name" TEXT,
    "ui_locale" TEXT NOT NULL DEFAULT 'zh',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lexemes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "normalized_lemma" TEXT NOT NULL,
    "canonical_lemma" TEXT NOT NULL,
    "word_type" TEXT,
    "frequency_class" SMALLINT,
    "ipa" TEXT,
    "dwds_url" TEXT,
    "source_json" JSONB NOT NULL DEFAULT '{}',
    "source_fetched_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lexemes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "encounters" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "lexeme_id" UUID NOT NULL,
    "surface_form" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "encounters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_lexemes" (
    "user_id" UUID NOT NULL,
    "lexeme_id" UUID NOT NULL,
    "first_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "encounter_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "user_lexemes_pkey" PRIMARY KEY ("user_id","lexeme_id")
);

-- CreateTable
CREATE TABLE "dwds_cache" (
    "endpoint" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "fetched_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dwds_cache_pkey" PRIMARY KEY ("endpoint","query")
);

-- CreateIndex
CREATE UNIQUE INDEX "lexemes_normalized_lemma_key" ON "lexemes"("normalized_lemma");

-- CreateIndex
CREATE INDEX "lexemes_word_type_idx" ON "lexemes"("word_type");

-- CreateIndex
CREATE INDEX "lexemes_frequency_class_idx" ON "lexemes"("frequency_class");

-- CreateIndex
CREATE INDEX "encounters_user_id_created_at_idx" ON "encounters"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "encounters_user_id_lexeme_id_created_at_idx" ON "encounters"("user_id", "lexeme_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "user_lexemes_user_id_last_seen_at_idx" ON "user_lexemes"("user_id", "last_seen_at" DESC);

-- AddForeignKey
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_lexeme_id_fkey" FOREIGN KEY ("lexeme_id") REFERENCES "lexemes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_lexemes" ADD CONSTRAINT "user_lexemes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_lexemes" ADD CONSTRAINT "user_lexemes_lexeme_id_fkey" FOREIGN KEY ("lexeme_id") REFERENCES "lexemes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
