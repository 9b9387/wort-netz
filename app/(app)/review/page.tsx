import { Suspense } from "react";
import { connection } from "next/server";
import { RepeatIcon } from "lucide-react";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/server/auth";
import { getDictionary } from "@/lib/i18n";

export default function ReviewPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 rounded-xl" />}>
      <ReviewContent />
    </Suspense>
  );
}

async function ReviewContent() {
  await connection();
  const t = getDictionary("zh");
  await requireUser();

  return (
    <div className="mx-auto w-full max-w-5xl">
      <section className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-primary">
          {t.sectionSrs}
        </h1>
        <p className="text-muted-foreground">{t.reviewPlaceholder}</p>
      </section>

      <Empty className="mt-6 border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <RepeatIcon />
          </EmptyMedia>
          <EmptyTitle>{t.reviewComingSoon}</EmptyTitle>
          <EmptyDescription>{t.reviewComingSoonHint}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>
  );
}
