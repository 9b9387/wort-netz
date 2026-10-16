"use client";

import { startTransition, useTransition } from "react";
import { StarIcon } from "lucide-react";
import { toggleFavorite } from "@/app/actions/word-study";
import { Button } from "@/components/ui/button";

export function FavoriteButton({
  lexemeId,
  isFavorite,
  labels,
}: {
  lexemeId: string;
  isFavorite: boolean;
  labels: {
    favorite: string;
    favorited: string;
  };
}) {
  const [pending] = useTransition();

  return (
    <Button
      variant={isFavorite ? "secondary" : "outline"}
      size="sm"
      disabled={pending}
      onClick={() => {
        startTransition(() => {
          void toggleFavorite(lexemeId, isFavorite);
        });
      }}
    >
      <StarIcon data-icon="inline-start" />
      {isFavorite ? labels.favorited : labels.favorite}
    </Button>
  );
}
