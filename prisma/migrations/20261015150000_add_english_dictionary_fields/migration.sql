ALTER TABLE "lexemes"
  ADD COLUMN "definition_en" TEXT,
  ADD COLUMN "forms_json" JSONB,
  ADD COLUMN "dictionary_url" TEXT,
  ADD COLUMN "dictionary_source" TEXT,
  ADD COLUMN "dictionary_license" TEXT,
  ADD COLUMN "dictionary_fetched_at" TIMESTAMPTZ(6);
