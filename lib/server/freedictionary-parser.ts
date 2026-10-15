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

function preferredPartOfSpeech(wordType: string | null): string | null {
  if (!wordType) {
    return null;
  }

  if (wordType.includes("Substantiv") || wordType === "Eigenname") {
    return "noun";
  }

  if (wordType.includes("Verb")) {
    return "verb";
  }

  if (wordType.includes("Adjektiv")) {
    return "adjective";
  }

  if (wordType.includes("Adverb")) {
    return "adverb";
  }

  if (wordType.includes("Pronomen")) {
    return "pronoun";
  }

  return null;
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
    .map((sense) => sense.definition?.trim())
    .filter((definition): definition is string => Boolean(definition));

  const uniqueDefinitions = Array.from(new Set(definitions));

  if (uniqueDefinitions.length === 0) {
    return null;
  }

  return uniqueDefinitions.join("\n");
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
    formsJson,
    dictionaryUrl:
      response.source?.url ??
      `https://en.wiktionary.org/wiki/${encodeURIComponent(lemma)}`,
    dictionarySource: "FreeDictionaryAPI.com",
    dictionaryLicense: response.source?.license?.name ?? "CC BY-SA 4.0",
  };
}
