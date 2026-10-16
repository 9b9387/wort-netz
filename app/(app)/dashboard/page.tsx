import { Suspense } from "react";
import { connection } from "next/server";
import { NetworkIcon } from "lucide-react";
import { SearchForm } from "@/components/search-form";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getDictionary } from "@/lib/i18n";
import { requireUser } from "@/lib/server/auth";
import { getUserStats } from "@/lib/server/lexemes";

export default function DashboardPage() {
  const t = getDictionary("zh");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 py-4">
      <section className="flex flex-col items-center gap-4 text-center">
        <span className="flex size-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <NetworkIcon className="size-8" />
        </span>
        <div className="flex flex-col gap-1.5">
          <h1 className="font-heading text-4xl font-semibold tracking-tight">
            {t.appName}
          </h1>
          <p className="text-muted-foreground">{t.tagline}</p>
        </div>
      </section>

      <Card className="shadow-plate">
        <CardContent className="p-5">
          <SearchForm
            placeholder={t.searchPlaceholder}
            submitLabel={t.search}
            pendingLabel={t.searching}
          />
        </CardContent>
      </Card>

      <Suspense fallback={<StatsSkeleton />}>
        <Stats />
      </Suspense>
    </div>
  );
}

async function Stats() {
  await connection();
  const t = getDictionary("zh");
  const user = await requireUser();
  const stats = await getUserStats(user.id);

  return (
    <section className="grid gap-4 sm:grid-cols-2">
      <StatCard label={t.totalWords} value={stats.totalWords} />
      <StatCard label={t.totalEncounters} value={stats.totalEncounters} />
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-2 py-6">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="font-heading text-4xl font-semibold">{value}</span>
      </CardContent>
    </Card>
  );
}

function StatsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Skeleton className="h-28 rounded-xl" />
      <Skeleton className="h-28 rounded-xl" />
    </div>
  );
}
