-- External response cache for Tatoeba example-sentence lookups.
CREATE TABLE "tatoeba_cache" (
  "query" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "fetched_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tatoeba_cache_pkey" PRIMARY KEY ("query")
);
