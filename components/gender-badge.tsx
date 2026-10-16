import { Badge } from "@/components/ui/badge";

export type GrammaticalGender = "masculine" | "feminine" | "neuter";

export type GenderInfo = {
  article: string;
  tone: GrammaticalGender;
};

const genderClassNames: Record<GrammaticalGender, string> = {
  masculine:
    "border-gender-masculine bg-gender-masculine-muted text-gender-masculine-foreground",
  feminine:
    "border-gender-feminine bg-gender-feminine-muted text-gender-feminine-foreground",
  neuter:
    "border-gender-neuter bg-gender-neuter-muted text-gender-neuter-foreground",
};

export function getGrammaticalGender(
  wordType: string | null | undefined,
): GenderInfo | null {
  if (!wordType) {
    return null;
  }

  const normalized = wordType.toLowerCase();

  if (!normalized.includes("substantiv") && !normalized.includes("noun")) {
    return null;
  }

  if (
    normalized.includes("maskulin") ||
    normalized.includes("masculine") ||
    normalized.includes("männlich")
  ) {
    return { article: "der", tone: "masculine" };
  }

  if (
    normalized.includes("feminin") ||
    normalized.includes("feminine") ||
    normalized.includes("weiblich")
  ) {
    return { article: "die", tone: "feminine" };
  }

  if (
    normalized.includes("neutral") ||
    normalized.includes("neutrum") ||
    normalized.includes("sächlich")
  ) {
    return { article: "das", tone: "neuter" };
  }

  return null;
}

export function getGenderInfo(
  gender: string | null | undefined,
  wordType: string | null | undefined,
): GenderInfo | null {
  if (gender === "masculine") {
    return { article: "der", tone: "masculine" };
  }

  if (gender === "feminine") {
    return { article: "die", tone: "feminine" };
  }

  if (gender === "neuter") {
    return { article: "das", tone: "neuter" };
  }

  return getGrammaticalGender(wordType);
}

export function GenderBadge({
  gender,
  wordType,
}: {
  gender?: string | null;
  wordType: string | null | undefined;
}) {
  const info = getGenderInfo(gender, wordType);

  if (!info) {
    return null;
  }

  return (
    <Badge variant="outline" className={genderClassNames[info.tone]}>
      {info.article}
    </Badge>
  );
}
