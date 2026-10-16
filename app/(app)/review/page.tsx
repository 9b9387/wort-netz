import { Suspense } from "react";
import { connection } from "next/server";
import { ReviewScreen } from "@/components/review/review-screen";
import { Skeleton } from "@/components/ui/skeleton";
import { getDictionary } from "@/lib/i18n";
import { requireUser } from "@/lib/server/auth";
import { getReviewOverview, getReviewPlan } from "@/lib/server/review";

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
  const user = await requireUser();
  const plan = await getReviewPlan(user.id);
  /**
   * The server renders the first paint with the offset remembered on the
   * profile; the client corrects it and refetches when the browser disagrees.
   */
  const overview = await getReviewOverview(user.id, plan.tzOffsetMinutes);

  return (
    <ReviewScreen
      initialOverview={overview}
      initialTzOffsetMinutes={plan.tzOffsetMinutes}
      t={t}
    />
  );
}
