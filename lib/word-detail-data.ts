/**
 * Pure data assembly for the word detail view. Shared by the full `/words/[id]`
 * page and the compact reader panel so both render the same information.
 */

import type { UserWordDetail } from "@/lib/server/lexemes";
import {
  normalizeForms,
  resolveDefinitionSets,
  type WordFormEntry,
  type WordnetRelatedWordLike,
} from "@/lib/word-display";

export const RELATED_WORDS_LIMIT = 6;
export const LEITNER_BOX_MAX = 5;

export type ParsedForms = {
  genitive: string | null;
  plural: string | null;
  forms: WordFormEntry[];
};

export type RelationGroupKey =
  | "synonyms"
  | "antonyms"
  | "hypernyms"
  | "hyponyms";

export type RelationGroup = {
  key: RelationGroupKey;
  words: WordnetRelatedWordLike[];
};

export type SurfaceFormCount = {
  surfaceForm: string;
  count: number;
  latest: Date;
};

export type WordDetailViewData = {
  forms: ParsedForms | null;
  normalizedForms: WordFormEntry[];
  /** German senses from OdeNet; the German card is hidden when empty. */
  germanDefinitions: string[];
  /** English senses (dictionary + OdeNet), shown above the German ones. */
  englishDefinitions: string[];
  relationGroups: RelationGroup[];
  relatedWords: Array<{ lemma: string; lexemeId: string }>;
  surfaceFormCounts: SurfaceFormCount[];
};

export function parseFormsJson(value: unknown): ParsedForms | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const forms = Array.isArray(record.forms)
    ? record.forms
        .filter(
          (form): form is { word: string; tags?: unknown } =>
            Boolean(form) &&
            typeof form === "object" &&
            typeof (form as { word?: unknown }).word === "string",
        )
        .map((form) => ({
          word: form.word,
          tags: Array.isArray(form.tags)
            ? form.tags.filter((tag): tag is string => typeof tag === "string")
            : [],
        }))
    : [];

  return {
    genitive: typeof record.genitive === "string" ? record.genitive : null,
    plural: typeof record.plural === "string" ? record.plural : null,
    forms,
  };
}

function countSurfaceForms(
  surfaceForms: UserWordDetail["surfaceForms"],
): SurfaceFormCount[] {
  const counts = new Map<string, { count: number; latest: Date }>();

  for (const item of surfaceForms) {
    const current = counts.get(item.surfaceForm) ?? {
      count: 0,
      latest: item.createdAt,
    };

    counts.set(item.surfaceForm, {
      count: current.count + 1,
      latest:
        item.createdAt > current.latest ? item.createdAt : current.latest,
    });
  }

  return Array.from(counts.entries()).map(([surfaceForm, value]) => ({
    surfaceForm,
    count: value.count,
    latest: value.latest,
  }));
}

export function buildWordDetailData(
  detail: UserWordDetail,
): WordDetailViewData {
  const forms = parseFormsJson(detail.lexeme.formsJson);
  const definitions = resolveDefinitionSets({
    german:
      detail.wordnet?.definitions
        .filter((definition) => definition.language === "de")
        .map((definition) => definition.text) ?? [],
    english: [
      ...(detail.lexeme.definitionEn?.split("\n") ?? []),
      ...(detail.wordnet?.definitions
        .filter((definition) => definition.language === "en")
        .map((definition) => definition.text) ?? []),
    ],
  });
  const relationGroups = (
    [
      { key: "synonyms", words: detail.wordnet?.synonyms ?? [] },
      { key: "antonyms", words: detail.wordnet?.antonyms ?? [] },
      { key: "hypernyms", words: detail.wordnet?.hypernyms ?? [] },
      { key: "hyponyms", words: detail.wordnet?.hyponyms ?? [] },
    ] satisfies RelationGroup[]
  ).filter((group) => group.words.length > 0);
  const relatedWords = Array.from(
    relationGroups
      .flatMap((group) => group.words)
      .reduce<Map<string, { lemma: string; lexemeId: string }>>((acc, word) => {
        if (
          word.lexemeId &&
          word.lexemeId !== detail.lexeme.id &&
          !acc.has(word.lemma)
        ) {
          acc.set(word.lemma, {
            lemma: word.lemma,
            lexemeId: word.lexemeId!,
          });
        }

        return acc;
      }, new Map())
      .values(),
  ).slice(0, RELATED_WORDS_LIMIT);

  return {
    forms,
    normalizedForms: forms ? normalizeForms(forms.forms) : [],
    germanDefinitions: definitions.german,
    englishDefinitions: definitions.english,
    relationGroups,
    relatedWords,
    surfaceFormCounts: countSurfaceForms(detail.surfaceForms),
  };
}
