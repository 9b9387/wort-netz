import "server-only";

import { fetchJson, fetchText } from "@/lib/server/http";

const DWDS_BASE_URL =
  process.env.DWDS_BASE_URL ?? "https://www.dwds.de/api";

export type DwdsEndpoint = "frequency" | "snippet" | "ipa";

type FrequencyResponse = {
  q?: string;
  lemma?: string | null;
  total?: number;
  hits?: number;
  frequency?: number;
};

type SnippetEntry = {
  input?: string;
  wortart?: string | null;
  lemma?: string;
  url?: string;
};

type IpaEntry = {
  ipa?: string;
  status?: "auto" | "proved" | string;
};

export type DwdsLookup = {
  canonicalLemma: string;
  wordType: string | null;
  gender: GrammaticalGender | null;
  frequencyClass: number | null;
  frequencyHits: number | null;
  ipa: string | null;
  dwdsUrl: string | null;
  found: boolean;
  sourceJson: Record<string, unknown>;
};

export type GrammaticalGender = "masculine" | "feminine" | "neuter";

export class DictionaryUnavailableError extends Error {
  constructor(message = "DWDS lookup unavailable") {
    super(message);
    this.name = "DictionaryUnavailableError";
  }
}

function endpointPath(endpoint: DwdsEndpoint): string {
  if (endpoint === "frequency") {
    return "/frequency";
  }

  if (endpoint === "snippet") {
    return "/wb/snippet";
  }

  return "/ipa";
}

export function dwdsUrl(endpoint: DwdsEndpoint, query: string): string {
  const url = new URL(`${DWDS_BASE_URL}${endpointPath(endpoint)}`);
  url.searchParams.set("q", query);
  return url.toString();
}

export function normalizeLexeme(input: string): string {
  return input.normalize("NFC").trim().toLowerCase();
}

function sanitizeLemma(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.normalize("NFC").trim();

  if (
    normalized.length === 0 ||
    normalized.length > 120 ||
    /\s/.test(normalized)
  ) {
    return null;
  }

  return normalized;
}

export function parseFrequency(raw: unknown): FrequencyResponse {
  if (!raw || typeof raw !== "object") {
    return {};
  }

  const value = raw as FrequencyResponse;
  const frequency =
    typeof value.frequency === "number" ? value.frequency : null;

  return {
    q: typeof value.q === "string" ? value.q : undefined,
    lemma: typeof value.lemma === "string" ? value.lemma : null,
    total: typeof value.total === "number" ? value.total : undefined,
    hits: typeof value.hits === "number" ? value.hits : undefined,
    frequency: frequency === null ? undefined : frequency,
  };
}

export function parseSnippet(raw: unknown): SnippetEntry {
  if (!Array.isArray(raw)) {
    return {};
  }

  const first = raw[0];
  if (!first || typeof first !== "object") {
    return {};
  }

  const entry = first as SnippetEntry;
  return {
    input: typeof entry.input === "string" ? entry.input : undefined,
    wortart: typeof entry.wortart === "string" ? entry.wortart : null,
    lemma:
      typeof entry.lemma === "string"
        ? sanitizeLemma(entry.lemma) ?? undefined
        : undefined,
    url: typeof entry.url === "string" ? entry.url : undefined,
  };
}

export function parseIpa(raw: unknown): string | null {
  if (!Array.isArray(raw)) {
    return null;
  }

  const entries = raw.filter(
    (entry): entry is IpaEntry =>
      Boolean(entry) &&
      typeof entry === "object" &&
      typeof (entry as IpaEntry).ipa === "string",
  );

  if (entries.length === 0) {
    return null;
  }

  const proved = entries.find((entry) => entry.status === "proved");
  return proved?.ipa ?? entries[0]?.ipa ?? null;
}

export function parseGenderFromDwdsHtml(html: string): GrammaticalGender | null {
  const match = html.match(
    /<meta[^>]+property="og:image:alt"[^>]+content="([^"]+)"/i,
  );

  if (!match?.[1]) {
    return null;
  }

  const metadata = match[1].toLowerCase();

  if (metadata.includes("maskulinum") || /\bder:/.test(metadata)) {
    return "masculine";
  }

  if (metadata.includes("femininum") || /\bdie:/.test(metadata)) {
    return "feminine";
  }

  if (metadata.includes("neutrum") || /\bdas:/.test(metadata)) {
    return "neuter";
  }

  return null;
}

async function lookupDwdsGender(
  lemma: string,
): Promise<GrammaticalGender | null> {
  try {
    const html = await fetchText(
      `https://www.dwds.de/wb/${encodeURIComponent(lemma)}`,
    );
    return parseGenderFromDwdsHtml(html);
  } catch (error) {
    console.error("DWDS gender lookup failed", {
      lemma,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function safeJson<T>(
  url: string,
): Promise<{ ok: true; data: T } | { ok: false; error: unknown }> {
  try {
    return { ok: true, data: await fetchJson<T>(url) };
  } catch (error) {
    return { ok: false, error };
  }
}

async function lookupDwdsOnce(query: string): Promise<DwdsLookup> {
  const surface = query.normalize("NFC").trim();
  const normalizedQuery = normalizeLexeme(surface);

  const frequencyResult = await safeJson<FrequencyResponse>(
    dwdsUrl("frequency", surface),
  );
  const frequency: FrequencyResponse = frequencyResult.ok
    ? parseFrequency(frequencyResult.data)
    : {};
  const frequencyLemma = sanitizeLemma(frequency.lemma);
  const initialLemma = frequencyLemma ?? surface;

  let snippetResult = await safeJson<unknown>(
    dwdsUrl("snippet", initialLemma),
  );
  let snippet: SnippetEntry = snippetResult.ok
    ? parseSnippet(snippetResult.data)
    : {};

  if (!snippet.lemma && !snippet.url && initialLemma !== surface) {
    const fallbackSnippet = await safeJson<unknown>(
      dwdsUrl("snippet", surface),
    );

    if (fallbackSnippet.ok) {
      snippetResult = fallbackSnippet;
      snippet = parseSnippet(fallbackSnippet.data);
    }
  }

  const lemmaForIpa = sanitizeLemma(snippet.lemma) ?? initialLemma;
  const ipaResult = await safeJson<unknown>(dwdsUrl("ipa", lemmaForIpa));
  const ipa = ipaResult.ok ? parseIpa(ipaResult.data) : null;

  const anySuccess = frequencyResult.ok || snippetResult.ok || ipaResult.ok;

  if (!anySuccess) {
    throw new DictionaryUnavailableError();
  }

  const canonicalLemma =
    sanitizeLemma(snippet.lemma) ?? frequencyLemma ?? surface;
  const wordType = snippet.wortart ?? null;
  const entryUrl = snippet.url ?? null;
  const gender = isNounWordType(wordType)
    ? await lookupDwdsGender(canonicalLemma)
    : null;
  const frequencyHits =
    typeof frequency.hits === "number" ? frequency.hits : null;
  const found = wordType !== null || entryUrl !== null;

  return {
    canonicalLemma,
    wordType,
    gender,
    frequencyClass:
      typeof frequency.frequency === "number" ? frequency.frequency : null,
    frequencyHits,
    ipa,
    dwdsUrl: entryUrl,
    found,
    sourceJson: {
      surface,
      normalizedQuery,
      frequency: frequencyResult.ok ? frequencyResult.data : null,
      snippet: snippetResult.ok ? snippetResult.data : null,
      ipa: ipaResult.ok ? ipaResult.data : null,
      gender,
    },
  };
}

function capitalizeFirst(value: string): string {
  return value.charAt(0).toLocaleUpperCase("de-DE") + value.slice(1);
}

function isNounWordType(wordType: string | null): boolean {
  return (
    wordType === "Substantiv" ||
    wordType === "Eigenname" ||
    wordType?.includes("Substantiv") === true
  );
}

function shouldTryCapitalized(surface: string, primary: DwdsLookup): boolean {
  if (!/^[a-zäöüß]/u.test(surface)) {
    return false;
  }

  if (!primary.found) {
    return true;
  }

  const base = normalizeLexeme(surface);
  const primaryLemma = normalizeLexeme(primary.canonicalLemma);

  return primaryLemma === `${base}n` || primaryLemma === `${base}en`;
}

export async function lookupDwds(query: string): Promise<DwdsLookup> {
  const surface = query.normalize("NFC").trim();
  const primary = await lookupDwdsOnce(surface);

  if (!shouldTryCapitalized(surface, primary)) {
    return primary;
  }

  const capitalized = await lookupDwdsOnce(capitalizeFirst(surface));
  const primaryFrequency = primary.frequencyClass ?? -1;
  const capitalizedFrequency = capitalized.frequencyClass ?? -1;

  if (
    isNounWordType(capitalized.wordType) &&
    !isNounWordType(primary.wordType) &&
    capitalizedFrequency > primaryFrequency
  ) {
    return capitalized;
  }

  return primary;
}
