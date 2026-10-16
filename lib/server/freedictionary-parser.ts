import { dictionaryPartOfSpeech } from "@/lib/word-pos";

type FreeDictionaryForm = {
  word?: string;
  tags?: string[];
};

type FreeDictionarySense = {
  definition?: string;
  tags?: string[];
  examples?: string[];
  synonyms?: string[];
  antonyms?: string[];
  subsenses?: FreeDictionarySense[];
};

type FreeDictionaryEntry = {
  language?: {
    code?: string;
    name?: string;
  };
  partOfSpeech?: string;
  pronunciations?: Array<{
    type?: string;
    text?: string;
    tags?: string[];
  }>;
  forms?: FreeDictionaryForm[];
  senses?: FreeDictionarySense[];
  synonyms?: string[];
};

export type FreeDictionaryResponse = {
  word?: string;
  entries?: FreeDictionaryEntry[];
  source?: {
    url?: string;
    license?: {
      name?: string;
      url?: string;
    };
  };
};

export type EnglishDictionaryResult = {
  definitionEn: string | null;
  /**
   * Every sense of every German entry the API returned, with the part of speech
   * of its entry. A spelling like "wollen" has both an adjective reading
   * (wool) and a verb reading (to want); keeping all of them lets the UI rank
   * and list them instead of showing whatever came first.
   */
  senses: EnglishDictionarySense[];
  formsJson: {
    genitive: string | null;
    plural: string | null;
    forms: Array<{
      word: string;
      tags: string[];
    }>;
  } | null;
  dictionaryUrl: string | null;
  dictionarySource: string;
  dictionaryLicense: string | null;
};

export type EnglishDictionarySense = {
  text: string;
  /** Wiktionary part of speech of the entry, e.g. "verb". */
  partOfSpeech: string | null;
  tags: string[];
  /** Position inside the entry. */
  order: number;
  /** Position of the entry in the response. */
  entryOrder: number;
};

function preferredPartOfSpeech(wordType: string | null): string | null {
  return dictionaryPartOfSpeech(wordType);
}

function scoreEntry(
  entry: FreeDictionaryEntry,
  wantedPartOfSpeech: string | null,
): number {
  let score = 0;

  if (entry.language?.code === "de") {
    score += 100;
  }

  if (
    wantedPartOfSpeech &&
    entry.partOfSpeech?.toLowerCase() === wantedPartOfSpeech
  ) {
    score += 20;
  }

  const senses = entry.senses ?? [];

  if (senses.length > 0) {
    score += 5;
  }

  if (
    senses.some((sense) => {
      const tags = sense.tags ?? [];
      return tags.includes("form of") || tags.includes("plural");
    })
  ) {
    score -= 10;
  }

  if (
    entry.forms?.some((form) => (form.tags ?? []).includes("plural")) === true
  ) {
    score += 2;
  }

  return score;
}

function meaningfulForms(
  forms: FreeDictionaryForm[] | undefined,
): Array<{ word: string; tags: string[] }> {
  return (forms ?? [])
    .filter((form) => typeof form.word === "string")
    .map((form) => ({
      word: form.word!,
      tags: form.tags ?? [],
    }))
    .filter((form) => {
      const ignoredTags = ["table-tags", "inflection-template"];
      return !form.tags.some((tag) => ignoredTags.includes(tag));
    });
}

function pickForm(
  forms: Array<{ word: string; tags: string[] }>,
  tag: string,
): string | null {
  const candidates = forms.filter((form) => form.tags.includes(tag));

  if (candidates.length === 0) {
    return null;
  }

  const preferred = candidates.find(
    (form) => !form.tags.includes("definite") && !form.tags.includes("plural"),
  );

  return preferred?.word ?? candidates[0]?.word ?? null;
}

function definitionsFromEntry(entry: FreeDictionaryEntry): string | null {
  const definitions = (entry.senses ?? [])
    .flatMap(flattenSense)
    .map((sense) => sense.text);

  const uniqueDefinitions = Array.from(new Set(definitions));

  if (uniqueDefinitions.length === 0) {
    return null;
  }

  return uniqueDefinitions.join("\n");
}

/**
 * Wiktionary groups related meanings under a label sense ("As a copulative
 * verb:") and keeps the real wording in `subsenses`. The label alone is not a
 * meaning, so the subsenses replace it; a plain sense is returned as is.
 */
type FlatSense = { text: string; tags: string[] };

function normalizeTags(tags: readonly string[] | undefined): string[] {
  return Array.from(
    new Set(
      (tags ?? [])
        .filter((tag): tag is string => typeof tag === "string")
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

function flattenSense(sense: FreeDictionarySense): FlatSense[] {
  const parentTags = normalizeTags(sense.tags);
  const subsenses = (sense.subsenses ?? [])
    .map((subsense) => ({
      text: subsense.definition?.trim() ?? "",
      // A subsense inherits its group's label tags, never its siblings'.
      tags: Array.from(
        new Set([...parentTags, ...normalizeTags(subsense.tags)]),
      ),
    }))
    .filter((item) => Boolean(item.text));

  if (subsenses.length > 0) {
    return subsenses;
  }

  const definition = sense.definition?.trim();

  return definition ? [{ text: definition, tags: parentTags }] : [];
}

/**
 * All senses of all German entries, in response order. Duplicates (the same
 * definition repeated across entries) are dropped, keeping the first position.
 */
function sensesFromEntries(
  entries: readonly FreeDictionaryEntry[],
): EnglishDictionarySense[] {
  const senses: EnglishDictionarySense[] = [];
  const seen = new Set<string>();

  entries.forEach((entry, entryOrder) => {
    const partOfSpeech =
      typeof entry.partOfSpeech === "string"
        ? entry.partOfSpeech.trim().toLowerCase() || null
        : null;

    (entry.senses ?? []).forEach((sense) => {
      let order = 0;

      for (const flat of flattenSense(sense)) {
        const text = flat.text;
        const key = text.toLowerCase();

        if (seen.has(key)) {
          continue;
        }

        seen.add(key);
        senses.push({
          text,
          partOfSpeech,
          tags: flat.tags,
          order,
          entryOrder,
        });
        order += 1;
      }
    });
  });

  return senses;
}

export function parseFreeDictionaryResponse(
  response: FreeDictionaryResponse,
  lemma: string,
  wordType: string | null,
): EnglishDictionaryResult | null {
  const wantedPartOfSpeech = preferredPartOfSpeech(wordType);
  const entries = (response.entries ?? []).filter(
    (entry) => entry.language?.code === "de",
  );

  if (entries.length === 0) {
    return null;
  }

  const entry = [...entries].sort(
    (a, b) =>
      scoreEntry(b, wantedPartOfSpeech) -
      scoreEntry(a, wantedPartOfSpeech),
  )[0];

  const definitionEn = definitionsFromEntry(entry);
  const senses = sensesFromEntries(entries);
  const forms = meaningfulForms(entry.forms);
  const formsJson =
    forms.length === 0
      ? null
      : {
          genitive: pickForm(forms, "genitive"),
          plural: pickForm(forms, "plural"),
          forms,
        };

  return {
    definitionEn,
    senses,
    formsJson,
    dictionaryUrl:
      response.source?.url ??
      `https://en.wiktionary.org/wiki/${encodeURIComponent(lemma)}`,
    dictionarySource: "FreeDictionaryAPI.com",
    dictionaryLicense: response.source?.license?.name ?? "CC BY-SA 4.0",
  };
}
