"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, PlusIcon } from "lucide-react";
import { addWordToBook } from "@/app/actions/words";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { getDictionary } from "@/lib/i18n";

/**
 * Explicit opt-in: looking a word up never adds it to the word book, this button
 * does.
 */
export function AddToWordBookButton({
  lexemeId,
  surfaceForm,
  inWordBook,
}: {
  lexemeId: string;
  surfaceForm: string | null;
  inWordBook: boolean;
}) {
  const t = getDictionary("zh");
  const router = useRouter();
  const [added, setAdded] = useState(inWordBook);
  const [pending, startTransition] = useTransition();

  if (added) {
    return (
      <Button variant="secondary" size="sm" disabled>
        <CheckIcon data-icon="inline-start" />
        {t.addedToWordBook}
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const result = await addWordToBook({ lexemeId, surfaceForm });

          if (result.ok) {
            setAdded(true);
            router.refresh();
          }
        });
      }}
    >
      {pending ? (
        <Spinner data-icon="inline-start" />
      ) : (
        <PlusIcon data-icon="inline-start" />
      )}
      {t.addToWordBook}
    </Button>
  );
}
