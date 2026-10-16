import { Suspense } from "react";
import { connection } from "next/server";
import { Skeleton } from "@/components/ui/skeleton";
import { WordDetailView } from "@/components/word-detail-view";
import {
  WordBookScreen,
  type WordBookEntry,
} from "@/components/wordbook/word-book-screen";
import { getDictionary } from "@/lib/i18n";
import { requireUser } from "@/lib/server/auth";
import { getWordBookWords, getUserWordDetail } from "@/lib/server/lexemes";
import { selectWordBookEntry } from "@/lib/wordbook/selection";
import {
  parseWordBookFavorites,
  parseWordBookQuery,
  parseWordBookStatus,
  parseWordBookSort,
  WORD_BOOK_PAGE_SIZE,
} from "@/lib/wordbook/sort";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function WordBookPage({
  searchParams,
}: {
  searchParams: Promise<{ w?: string | string[] }>;
}) {
  return (
    <Suspense fallback={<WordBookSkeleton />}>
      <WordBookContent searchParams={searchParams} />
    </Suspense>
  );
}

async function WordBookContent({
  searchParams,
}: {
  searchParams: Promise<{
    w?: string | string[];
    sort?: string | string[];
    q?: string | string[];
    status?: string | string[];
    fav?: string | string[];
  }>;
}) {
  await connection();
  const t = getDictionary("zh");
  const user = await requireUser();
  const params = await searchParams;
  const requested = Array.isArray(params.w) ? params.w[0] : params.w;
  const sort = parseWordBookSort(params.sort);
  const query = parseWordBookQuery(params.q);
  const status = parseWordBookStatus(params.status);
  const favorites = parseWordBookFavorites(params.fav);
  const { words, hasMore } = await getWordBookWords(user.id, {
    sort,
    query,
    status,
    favorites,
    limit: WORD_BOOK_PAGE_SIZE,
  });
  const selectedId = selectWordBookEntry(
    words.map((word) => word.lexemeId),
    requested && UUID_PATTERN.test(requested) ? requested : null,
  );
  const detail = selectedId
    ? await getUserWordDetail(user.id, selectedId)
    : null;
  const entries: WordBookEntry[] = words.map((word) => ({
    lexemeId: word.lexemeId,
    canonicalLemma: word.canonicalLemma,
    wordType: word.wordType,
    ipa: word.ipa,
    level: word.level,
    isFavorite: word.isFavorite,
    definitionEn: word.definitionEn,
    gloss: word.gloss,
    baseLemma: word.baseLemma,
    status: word.status,
    encounterCount: word.encounterCount,
    lastSeenAt: word.lastSeenAt.toISOString(),
  }));

  return (
    <WordBookScreen
      words={entries}
      hasMore={hasMore}
      sort={sort}
      query={query}
      status={status}
      favorites={favorites}
      selectedId={selectedId}
      t={t}
      detailSlot={
        detail ? (
          <WordDetailView detail={detail} t={t} variant="panel" />
        ) : null
      }
    />
  );
}

function WordBookSkeleton() {
  return (
    <div className="flex min-h-0 w-full flex-col gap-4 lg:flex-row">
      <Skeleton className="h-[320px] w-full rounded-xl lg:h-auto lg:w-[320px] lg:shrink-0" />
      <Skeleton className="h-[520px] min-w-0 flex-1 rounded-xl" />
    </div>
  );
}
