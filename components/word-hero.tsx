import { StarIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { FavoriteButton } from "@/components/favorite-button";
import { GenderBadge, getGenderInfo } from "@/components/gender-badge";
import { PronunciationBar } from "@/components/pronunciation-bar";
import { WordDefinitions } from "@/components/word-definitions";
import type { TranslationLabels } from "@/components/word-translation";
import { cn } from "@/lib/utils";
import {
  frequencyStarTotal,
  frequencyStars,
  type ResolvedDefinitions,
} from "@/lib/word-display";

export function WordHero({
  lexemeId,
  lemma,
  wordType,
  gender,
  ipa,
  frequencyClass,
  vocabularyLevels,
  genitive,
  plural,
  isFavorite,
  definitions,
  definitionLabel,
  englishFallbackNote,
  frequencyLabel,
  genitiveLabel,
  pluralLabel,
  labels,
  translationLabels,
}: {
  lexemeId: string;
  lemma: string;
  wordType: string | null;
  gender: string | null;
  ipa: string | null;
  frequencyClass: number | null;
  vocabularyLevels: Array<{ level: string; source: string }>;
  genitive: string | null;
  plural: string | null;
  isFavorite: boolean;
  definitions: ResolvedDefinitions;
  definitionLabel: string;
  englishFallbackNote: string;
  frequencyLabel: string;
  genitiveLabel: string;
  pluralLabel: string;
  labels: {
    pronounce: string;
    favorite: string;
    favorited: string;
  };
  translationLabels: TranslationLabels;
}) {
  const genderInfo = getGenderInfo(gender, wordType);
  const stars = frequencyStars(frequencyClass);
  const starTotal = frequencyStarTotal();
  const hasDefinitions = definitions.items.length > 0;

  return (
    <Card className="relative overflow-hidden shadow-plate">
      <CardContent className="flex flex-col gap-6 p-5 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <GenderBadge gender={gender} wordType={wordType} />
            {wordType && <Badge variant="secondary">{wordType}</Badge>}
            {vocabularyLevels.map((level) => (
              <Badge
                key={level.level}
                variant="outline"
                className="border-cefr bg-cefr-muted font-code text-cefr-foreground"
                title={level.source}
              >
                {level.level}
              </Badge>
            ))}
            {genitive && (
              <Badge variant="outline">
                {genitiveLabel}: {genitive}
              </Badge>
            )}
          </div>

          {frequencyClass !== null && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {frequencyLabel}
              </span>
              <span className="flex items-center text-accent-amber">
                {Array.from({ length: starTotal }).map((_, index) => (
                  <StarIcon
                    key={index}
                    className={cn(
                      "size-4",
                      index < stars ? "fill-current" : "text-border",
                    )}
                  />
                ))}
              </span>
              <span className="font-code text-xs text-muted-foreground">
                {frequencyClass}/{starTotal}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex min-w-0 flex-col gap-4">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              {genderInfo && (
                <span className="font-display text-2xl italic text-primary">
                  {genderInfo.article}
                </span>
              )}
              <h1 className="font-display text-4xl font-medium leading-none tracking-tight text-primary sm:text-[44px]">
                {lemma}
              </h1>
              {plural && (
                <span className="font-display text-lg text-muted-foreground">
                  ({pluralLabel}: {plural})
                </span>
              )}
            </div>

            <PronunciationBar text={lemma} label={labels.pronounce} ipa={ipa} />
          </div>

          <FavoriteButton
            lexemeId={lexemeId}
            isFavorite={isFavorite}
            labels={{
              favorite: labels.favorite,
              favorited: labels.favorited,
            }}
          />
        </div>

        {hasDefinitions && (
          <WordDefinitions
            items={definitions.items}
            label={definitionLabel}
            fallbackNote={
              definitions.source === "en" ? englishFallbackNote : null
            }
            labels={translationLabels}
          />
        )}
      </CardContent>
    </Card>
  );
}
