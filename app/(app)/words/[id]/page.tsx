import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { Skeleton } from "@/components/ui/skeleton";
import { WordDetailView } from "@/components/word-detail-view";
import { getDictionary } from "@/lib/i18n";
import { requireUser } from "@/lib/server/auth";
import { getUserWordDetail } from "@/lib/server/lexemes";
import { parseSurfaceForm } from "@/lib/word-surface";

export default function WordDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ s?: string | string[] }>;
}) {
  return (
    <Suspense fallback={<WordDetailSkeleton />}>
      <WordDetailContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function WordDetailContent({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ s?: string | string[] }>;
}) {
  await connection();
  const t = getDictionary("zh");
  const user = await requireUser();
  const { id } = await params;
  const surfaceForm = parseSurfaceForm((await searchParams).s);
  const detail = await getUserWordDetail(user.id, id);

  if (!detail) {
    notFound();
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <nav className="mx-auto flex w-full max-w-7xl items-center gap-2 text-sm text-muted-foreground">
        <Link
          className="underline-offset-4 transition-colors hover:text-primary hover:underline"
          href="/dashboard"
        >
          {t.dashboard}
        </Link>
        <span aria-hidden>/</span>
        <span className="font-display italic text-primary">
          {detail.lexeme.canonicalLemma}
        </span>
      </nav>

      <WordDetailView
        detail={detail}
        t={t}
        variant="page"
        surfaceForm={surfaceForm}
      />
    </div>
  );
}

function WordDetailSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-72 rounded-xl" />
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="flex flex-col gap-6 lg:col-span-8">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
        <div className="flex flex-col gap-6 lg:col-span-4">
          <Skeleton className="h-56 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
