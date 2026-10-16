import { Suspense } from "react";
import { connection } from "next/server";
import { ReaderScreen } from "@/components/reader/reader-screen";
import { ReaderWordDetail } from "@/components/reader/reader-word-detail";
import { Skeleton } from "@/components/ui/skeleton";
import { getDictionary } from "@/lib/i18n";
import { deriveReaderPaneView } from "@/lib/reader/pane-state";
import { getArticle, listArticles } from "@/lib/server/articles";
import { requireUser } from "@/lib/server/auth";
import { parseSurfaceForm } from "@/lib/word-surface";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ReaderSearchParams = {
  article?: string | string[];
  w?: string | string[];
  s?: string | string[];
  pane?: string | string[];
  draft?: string | string[];
};

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

export default function ReaderPage({
  searchParams,
}: {
  searchParams: Promise<ReaderSearchParams>;
}) {
  return (
    <Suspense fallback={<ReaderSkeleton />}>
      <ReaderContent searchParams={searchParams} />
    </Suspense>
  );
}

async function ReaderContent({
  searchParams,
}: {
  searchParams: Promise<ReaderSearchParams>;
}) {
  await connection();
  const t = getDictionary("zh");
  const user = await requireUser();
  const params = await searchParams;
  const articleParam = firstParam(params.article);
  const wordParam = firstParam(params.w);
  const surfaceParam = firstParam(params.s);
  const paneParam = firstParam(params.pane);
  const draftParam = firstParam(params.draft) === "1";
  const articleId =
    articleParam && UUID_PATTERN.test(articleParam) ? articleParam : null;
  const lexemeId = wordParam && UUID_PATTERN.test(wordParam) ? wordParam : null;
  const surfaceForm = parseSurfaceForm(surfaceParam ?? undefined);
  const [articles, article] = await Promise.all([
    listArticles(user.id),
    articleId ? getArticle(user.id, articleId) : Promise.resolve(null),
  ]);
  const view = deriveReaderPaneView({ w: lexemeId, pane: paneParam });

  return (
    <ReaderScreen
      t={t}
      articles={articles.map((item) => ({
        id: item.id,
        excerpt: item.excerpt,
        charCount: item.charCount,
        unlearnedCount: item.unlearnedCount,
        updatedAt: item.updatedAt.toISOString(),
      }))}
      activeArticle={
        article
          ? {
              id: article.id,
              content: article.content,
              updatedAt: article.updatedAt.toISOString(),
            }
          : null
      }
      draftParam={draftParam}
      view={view}
      activeLexemeId={lexemeId}
      paneQuery={{
        article: articleId,
        w: lexemeId,
        pane: paneParam,
        draft: draftParam ? "1" : null,
      }}
      wordSlot={
        lexemeId ? (
          <Suspense fallback={<WordPanelSkeleton />}>
            <ReaderWordDetail lexemeId={lexemeId} surfaceForm={surfaceForm} />
          </Suspense>
        ) : null
      }
    />
  );
}

function WordPanelSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-32 rounded-xl" />
      <Skeleton className="h-24 rounded-xl" />
      <Skeleton className="h-40 rounded-xl" />
    </div>
  );
}

function ReaderSkeleton() {
  return (
    <div className="flex min-h-0 w-full flex-col gap-4 lg:flex-row">
      <Skeleton className="h-[320px] w-full rounded-xl lg:h-auto lg:w-[320px] lg:shrink-0" />
      <Skeleton className="h-[520px] min-w-0 flex-1 rounded-xl" />
    </div>
  );
}
