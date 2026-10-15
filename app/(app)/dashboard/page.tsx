import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { BookOpenTextIcon } from "lucide-react";
import { SearchForm } from "@/components/search-form";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/server/auth";
import {
  getRecentUserWords,
  getUserStats,
} from "@/lib/server/lexemes";
import { getDictionary } from "@/lib/i18n";

export default function DashboardPage() {
  const t = getDictionary("zh");

  return (
    <div className="mx-auto w-full max-w-5xl">
      <section className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          {t.dashboard}
        </h1>
        <p className="text-muted-foreground">{t.tagline}</p>
      </section>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>{t.search}</CardTitle>
          <CardDescription>{t.searchPlaceholder}</CardDescription>
        </CardHeader>
        <CardContent>
          <SearchForm
            placeholder={t.searchPlaceholder}
            submitLabel={t.search}
            pendingLabel={t.searching}
          />
        </CardContent>
      </Card>

      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}

async function DashboardContent() {
  await connection();
  const t = getDictionary("zh");
  const user = await requireUser();
  const [stats, words] = await Promise.all([
    getUserStats(user.id),
    getRecentUserWords(user.id),
  ]);

  return (
    <>
      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <StatCard label={t.totalWords} value={stats.totalWords} />
        <StatCard label={t.totalEncounters} value={stats.totalEncounters} />
      </section>

      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-xl font-semibold">
            {t.recentWords}
          </h2>
        </div>

        {words.length === 0 ? (
          <Empty className="mt-4 border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <BookOpenTextIcon />
              </EmptyMedia>
              <EmptyTitle>{t.noWords}</EmptyTitle>
              <EmptyDescription>{t.searchPlaceholder}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Card className="mt-4">
            <CardContent className="p-0">
              <ul className="divide-y">
                {words.map((word) => (
                  <li key={word.lexemeId}>
                    <Link
                      className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-muted/50"
                      href={`/words/${word.lexemeId}`}
                    >
                      <div className="flex min-w-0 flex-col gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-lg font-medium">
                            {word.canonicalLemma}
                          </span>
                          {word.wordType && (
                            <Badge variant="secondary">
                              {word.wordType}
                            </Badge>
                          )}
                          {word.ipa && (
                            <Badge variant="outline">/{word.ipa}/</Badge>
                          )}
                        </div>
                      </div>
                      <Badge variant="secondary">
                        {word.encounterCount}×
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </section>
    </>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="font-heading text-3xl font-semibold">{value}</span>
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="mt-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
      </div>
      <Skeleton className="mt-6 h-52 rounded-xl" />
    </div>
  );
}
