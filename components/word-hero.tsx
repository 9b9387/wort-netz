import { StarIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { FavoriteButton } from "@/components/favorite-button";
import { GenderBadge, getGenderInfo } from "@/components/gender-badge";
import { PronunciationBar } from "@/components/pronunciation-bar";
import { WordDefinitions } from "@/components/word-definitions";
import {
  EnglishDefinitions,
  type EnglishGlossLabels,
} from "@/components/word-english-definitions";
import type { TranslationLabels } from "@/components/word-translation";
import type { Translation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { EnglishDefinitionItem } from "@/lib/word-senses";
import {
  frequencyStarTotal,
  frequencyStars,
} from "@/lib/word-display";

export function WordHero({
  compact = false,
  surfaceForm = null,
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
  germanDefinitions,
  englishSenses,
  t,
  definitionLabel,
  englishGlossLabels,
  frequencyLabel,
  genitiveLabel,
  pluralLabel,
  lemmaLabel,
  labels,
  translationLabels,
  actions,
}: {
  compact?: boolean;
  /**
   * The form as it appeared in the article ("willst"). When it differs from the
   * lemma it becomes the headline, so the card matches what was clicked, and the
   * dictionary lemma is called out next to it.
   */
  surfaceForm?: string | null;
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
  /** German senses; the card is hidden when the list is empty. */
  germanDefinitions: string[];
  /** English senses, shown above the German ones with a Chinese translation. */
  englishSenses: EnglishDefinitionItem[];
  t: Translation;
  definitionLabel: string;
  englishGlossLabels: EnglishGlossLabels;
  frequencyLabel: string;
  genitiveLabel: string;
  pluralLabel: string;
  lemmaLabel: string;
  labels: {
    pronounce: string;
    favorite: string;
    favorited: string;
  };
  translationLabels: TranslationLabels;
  /** Extra controls (add to word book, learning status) next to the favourite. */
  actions?: React.ReactNode;
}) {
  const genderInfo = getGenderInfo(gender, wordType);
  const stars = frequencyStars(frequencyClass);
  const starTotal = frequencyStarTotal();
  const hasGermanDefinitions = germanDefinitions.length > 0;
  const shownSurface =
    surfaceForm &&
    surfaceForm.normalize("NFC").trim().toLowerCase() !==
      lemma.normalize("NFC").trim().toLowerCase()
      ? surfaceForm.trim()
      : null;

  return (
    <Card className="relative overflow-hidden shadow-plate">
      <CardContent
        className={cn(
          "flex flex-col",
          compact ? "gap-4 p-4" : "gap-6 p-5 sm:p-8",
        )}
      >
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
              <h1
                className={cn(
                  "font-display font-medium leading-none tracking-tight text-primary",
                  compact ? "text-3xl" : "text-4xl sm:text-[44px]",
                )}
              >
                {shownSurface ?? lemma}
              </h1>
              {shownSurface && (
                <span className="flex items-baseline gap-1.5 font-display text-lg text-muted-foreground">
                  <span>
                    {lemmaLabel}: {lemma}
                  </span>
                  {ipa && (
                    <span className="font-code text-sm">[{ipa}]</span>
                  )}
                </span>
              )}
              {plural && (
                <span className="font-display text-lg text-muted-foreground">
                  ({pluralLabel}: {plural})
                </span>
              )}
            </div>

            <PronunciationBar
              text={shownSurface ?? lemma}
              label={labels.pronounce}
              ipa={shownSurface ? null : ipa}
            />
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <FavoriteButton
              lexemeId={lexemeId}
              isFavorite={isFavorite}
              labels={{
                favorite: labels.favorite,
                favorited: labels.favorited,
              }}
            />
            {actions}
          </div>
        </div>

        {englishSenses.length > 0 && (
          <EnglishDefinitions
            items={englishSenses}
            labels={englishGlossLabels}
            t={t}
          />
        )}

        {hasGermanDefinitions && (
          <WordDefinitions
            items={germanDefinitions}
            label={definitionLabel}
            labels={translationLabels}
          />
        )}
      </CardContent>
    </Card>
  );
}
