import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { FavoriteButton } from "@/components/favorite-button";
import { GenderBadge, getGenderInfo } from "@/components/gender-badge";
import { SpeakButton } from "@/components/speak-button";
import { cn } from "@/lib/utils";

export function WordCard({
  lexemeId,
  lemma,
  wordType,
  gender,
  ipa,
  frequencyClass,
  vocabularyLevels,
  genitive,
  plural,
  encounterCount,
  isFavorite,
  labels,
}: {
  lexemeId: string;
  lemma: string;
  wordType: string | null;
  gender: string | null;
  ipa: string | null;
  frequencyClass: number | null;
  vocabularyLevels: Array<{
    level: string;
    source: string;
  }>;
  genitive: string | null;
  plural: string | null;
  encounterCount: number;
  isFavorite: boolean;
  labels: {
    pronounce: string;
    favorite: string;
    favorited: string;
    frequency: string;
    genitive: string;
    plural: string;
    encounterCount: string;
  };
}) {
  const genderInfo = getGenderInfo(gender, wordType);
  const genderBorderClass = genderInfo
    ? {
        masculine: "border-l-gender-masculine",
        feminine: "border-l-gender-feminine",
        neuter: "border-l-gender-neuter",
      }[genderInfo.tone]
    : "border-l-border";

  return (
    <Card className={cn("border-l-4", genderBorderClass)}>
      <CardContent className="flex flex-col gap-6 p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {wordType && <Badge variant="secondary">{wordType}</Badge>}
            {vocabularyLevels.map((level) => (
              <Badge
                key={level.level}
                variant="outline"
                className="border-cefr bg-cefr-muted text-cefr-foreground"
                title={level.source}
              >
                Goethe {level.level}
              </Badge>
            ))}
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

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="flex min-w-0 flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-4xl font-semibold leading-none tracking-tight sm:text-5xl">
                {lemma}
              </h1>
              <GenderBadge gender={gender} wordType={wordType} />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {ipa && (
                <Badge variant="outline" className="font-code text-sm">
                  /{ipa}/
                </Badge>
              )}
              {frequencyClass !== null && (
                <Badge variant="secondary">
                  {labels.frequency} {frequencyClass}/6
                </Badge>
              )}
              {genitive && (
                <Badge variant="outline">
                  {labels.genitive}: {genitive}
                </Badge>
              )}
              {plural && (
                <Badge
                  variant="outline"
                  className="border-gender-plural bg-gender-plural-muted text-gender-plural-foreground"
                >
                  {labels.plural}: {plural}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex flex-col items-start gap-3 lg:items-end">
            <SpeakButton text={lemma} label={labels.pronounce} />
            <div className="rounded-xl bg-muted px-5 py-4 text-center">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {labels.encounterCount}
              </p>
              <p className="mt-1 font-display text-3xl font-semibold">
                {encounterCount}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
