import { connection } from "next/server";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { WordDetailView } from "@/components/word-detail-view";
import { getDictionary } from "@/lib/i18n";
import { requireUser } from "@/lib/server/auth";
import { getUserWordDetail } from "@/lib/server/lexemes";

/**
 * Server-rendered word detail for the reader's right pane. Shares the whole
 * presentation layer with `/words/[id]` through `WordDetailView`.
 */
export async function ReaderWordDetail({
  lexemeId,
  surfaceForm = null,
}: {
  lexemeId: string;
  /** The word as it appears in the article, e.g. "willst" for "wollen". */
  surfaceForm?: string | null;
}) {
  await connection();
  const t = getDictionary("zh");
  const user = await requireUser();
  const detail = await getUserWordDetail(user.id, lexemeId);

  if (!detail) {
    return (
      <Alert variant="destructive">
        <AlertTitle>{t.readerWordFailed}</AlertTitle>
        <AlertDescription>{t.readerWordNotFound}</AlertDescription>
      </Alert>
    );
  }

  return (
    <WordDetailView
      detail={detail}
      t={t}
      variant="panel"
      surfaceForm={surfaceForm}
    />
  );
}
