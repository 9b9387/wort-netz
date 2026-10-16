import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { connection } from "next/server";
import { Badge, badgeVariants } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { WordHero } from "@/components/word-hero";
import { ExampleSentenceList } from "@/components/example-sentence-list";
import { WordNoteForm } from "@/components/word-note-form";
import {
  WordTranslationProvider,
  type TranslationLabels,
} from "@/components/word-translation";
import { requireUser } from "@/lib/server/auth";
import { getUserWordDetail } from "@/lib/server/lexemes";
import { getOpenThesaurusSynonyms } from "@/lib/server/openthesaurus";
import { getTatoebaSentences } from "@/lib/server/tatoeba";
import { getDictionary } from "@/lib/i18n";
import type { Translation } from "@/lib/i18n";
import { buildExampleSentences } from "@/lib/example-sentences";
import {
  normalizeForms,
  resolveDefinitions,
  type WordnetRelatedWordLike,
} from "@/lib/word-display";

const LEITNER_BOX_MAX = 5;
const RELATED_WORDS_LIMIT = 6;

export default function WordDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<WordDetailSkeleton />}>
      <WordDetailContent params={params} />
    </Suspense>
  );
}

async function WordDetailContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const t = getDictionary("zh");
  const user = await requireUser();
  const { id } = await params;
  const detail = await getUserWordDetail(user.id, id);

  if (!detail) {
    notFound();
  }

  const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const surfaceFormCounts = detail.surfaceForms.reduce<
    Map<string, { count: number; latest: Date }>
  >((acc, item) => {
    const current = acc.get(item.surfaceForm) ?? {
      count: 0,
      latest: item.createdAt,
    };
    acc.set(item.surfaceForm, {
      count: current.count + 1,
      latest:
        item.createdAt > current.latest ? item.createdAt : current.latest,
    });
    return acc;
  }, new Map());

  const forms = parseFormsJson(detail.lexeme.formsJson);
  const definitions = resolveDefinitions({
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
  const relationGroups = [
    { title: t.synonyms, words: detail.wordnet?.synonyms ?? [] },
    { title: t.antonyms, words: detail.wordnet?.antonyms ?? [] },
    { title: t.hypernyms, words: detail.wordnet?.hypernyms ?? [] },
    { title: t.hyponyms, words: detail.wordnet?.hyponyms ?? [] },
  ].filter((group) => group.words.length > 0);
  const relatedWords = Array.from(
    relationGroups
      .flatMap((group) => group.words)
      .reduce<
        Map<string, { lemma: string; lexemeId: string }>
      >((acc, word) => {
        if (
          word.lexemeId &&
          word.lexemeId !== detail.lexeme.id &&
          !acc.has(word.lemma)
        ) {
          acc.set(word.lemma, {
            lemma: word.lemma,
            lexemeId: word.lexemeId,
          });
        }

        return acc;
      }, new Map())
      .values(),
  ).slice(0, RELATED_WORDS_LIMIT);
  const normalizedForms = forms ? normalizeForms(forms.forms) : [];

  const reviewStatusLabel = {
    NEW: t.statusNew,
    LEARNING: t.statusLearning,
    REVIEWING: t.statusReviewing,
    MASTERED: t.statusMastered,
  }[detail.reviewStatus] ?? t.statusNew;

  const translationLabels: TranslationLabels = {
    targetLabel: t.translationTargetLabel,
    enable: t.translationEnable,
    preparing: t.translationPreparing,
    unsupported: t.translationUnsupported,
    failed: t.translationFailed,
    retry: t.translationRetry,
  };

  return (
    <WordTranslationProvider>
      <article className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <nav className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link
            className="underline-offset-4 transition-colors hover:text-primary hover:underline"
            href="/dashboard"
          >
            {t.dashboard}
          </Link>
          <span aria-hidden>/</span>
          <span className="font-display italic text-primary">
            {detail.lexeme.canonicalLemma}
          </span>
        </nav>

        <WordHero
          lexemeId={detail.lexeme.id}
          lemma={detail.lexeme.canonicalLemma}
          wordType={detail.lexeme.wordType}
          gender={detail.lexeme.gender}
          ipa={detail.lexeme.ipa}
          frequencyClass={detail.lexeme.frequencyClass}
          vocabularyLevels={detail.vocabularyLevels}
          genitive={forms?.genitive ?? null}
          plural={forms?.plural ?? null}
          isFavorite={detail.isFavorite}
          definitions={definitions}
          definitionLabel={t.definitionDe}
          englishFallbackNote={t.englishFallbackNote}
          frequencyLabel={t.frequencyClassLabel}
          genitiveLabel={t.genitive}
          pluralLabel={t.plural}
          labels={{
            pronounce: t.pronounce,
            favorite: t.favorite,
            favorited: t.favorited,
          }}
          translationLabels={translationLabels}
        />

        <div className="grid items-start gap-6 lg:grid-cols-12">
          <main className="flex flex-col gap-6 lg:col-span-8">
            {forms && (forms.genitive || forms.plural || forms.forms.length > 0) && (
              <SectionCard
                title={t.sectionForms}
                titleZh={t.sectionFormsZh}
                meta={detail.lexeme.wordType ?? undefined}
              >
                <div className="flex flex-col gap-5">
                  <dl className="grid gap-4 sm:grid-cols-2">
                    {forms.genitive && (
                      <div className="rounded-lg border border-parchment-border bg-muted/60 p-3">
                        <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          {t.genitive}
                        </dt>
                        <dd className="mt-1 font-display text-lg">
                          {forms.genitive}
                        </dd>
                      </div>
                    )}
                    {forms.plural && (
                      <div className="rounded-lg border border-parchment-border bg-muted/60 p-3">
                        <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          {t.plural}
                        </dt>
                        <dd className="mt-1 font-display text-lg">
                          {forms.plural}
                        </dd>
                      </div>
                    )}
                  </dl>

                  {normalizedForms.length > 0 && (
                    <ul className="flex flex-wrap gap-2">
                      {normalizedForms.map((form) => (
                        <li key={form.word}>
                          <Badge variant="outline">
                            {form.word}
                            {form.tags.length > 0 && (
                              <span className="font-code text-muted-foreground">
                                {form.tags.join(", ")}
                              </span>
                            )}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </SectionCard>
            )}

            <Suspense fallback={<Skeleton className="h-48 rounded-xl" />}>
              <ExampleSentenceCard
                lemma={detail.lexeme.canonicalLemma}
                forms={normalizedForms.map((form) => form.word)}
                odenetExamples={detail.wordnet?.examples ?? []}
                t={t}
              />
            </Suspense>

            <SectionCard title={t.sectionNotes} titleZh={t.sectionNotesZh}>
              <WordNoteForm
                key={detail.noteUpdatedAt?.toISOString() ?? "empty"}
                lexemeId={detail.lexeme.id}
                noteContent={detail.noteContent}
                labels={{
                  myNotes: t.myNotes,
                  notePlaceholder: t.notePlaceholder,
                  saveNote: t.saveNote,
                  savingNote: t.savingNote,
                  noteSaved: t.noteSaved,
                }}
              />
            </SectionCard>
          </main>

          <aside className="flex flex-col gap-6 lg:col-span-4">
            <SectionCard title={t.sectionSrs} titleZh={t.sectionSrsZh}>
              <div className="flex flex-col gap-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{reviewStatusLabel}</Badge>
                  <Badge variant="outline">
                    {t.leitnerBox} {detail.leitnerBox}
                  </Badge>
                </div>

                <div className="flex flex-col gap-2">
                  <Progress value={(detail.leitnerBox / LEITNER_BOX_MAX) * 100} />
                  <span className="font-code text-xs text-muted-foreground">
                    {t.leitnerBox} {detail.leitnerBox}/{LEITNER_BOX_MAX}
                  </span>
                </div>

                <dl className="flex flex-col gap-3 text-sm">
                  <div>
                    <dt className="text-muted-foreground">{t.nextReview}</dt>
                    <dd className="mt-1">
                      {detail.dueAt
                        ? dateFormatter.format(new Date(detail.dueAt))
                        : t.notScheduled}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">
                      {t.totalEncounters}
                    </dt>
                    <dd className="mt-1 font-display text-lg">
                      {detail.encounterCount}
                    </dd>
                  </div>
                </dl>
              </div>
            </SectionCard>

            <SectionCard title={t.sectionLog} titleZh={t.sectionLogZh}>
              <div className="flex flex-col gap-5">
                <dl className="grid gap-4 text-sm">
                  <div>
                    <dt className="text-muted-foreground">{t.firstSeen}</dt>
                    <dd className="mt-1">
                      {dateFormatter.format(new Date(detail.firstSeenAt))}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{t.lastSeen}</dt>
                    <dd className="mt-1">
                      {dateFormatter.format(new Date(detail.lastSeenAt))}
                    </dd>
                  </div>
                </dl>

                <div className="flex flex-col gap-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t.surfaceForms}
                  </span>
                  {surfaceFormCounts.size === 0 ? (
                    <p className="text-muted-foreground">—</p>
                  ) : (
                    <ul className="flex flex-wrap gap-2">
                      {Array.from(surfaceFormCounts.entries()).map(
                        ([surfaceForm, value]) => (
                          <li key={surfaceForm}>
                            <Badge variant="outline">
                              {surfaceForm}
                              <span className="font-code text-muted-foreground">
                                ×{value.count}
                              </span>
                            </Badge>
                          </li>
                        ),
                      )}
                    </ul>
                  )}
                </div>
              </div>
            </SectionCard>

            <Suspense fallback={<Skeleton className="h-40 rounded-xl" />}>
              <SemanticNetwork
                lexemeId={detail.lexeme.id}
                canonicalLemma={detail.lexeme.canonicalLemma}
                groups={relationGroups}
                t={t}
              />
            </Suspense>

            {relatedWords.length > 0 && (
              <SectionCard
                title={t.sectionRelated}
                titleZh={t.sectionRelatedZh}
              >
                <ul className="flex flex-col gap-2">
                  {relatedWords.map((word) => (
                    <li key={word.lexemeId}>
                      <Link
                        className="flex items-center justify-between gap-3 rounded-lg border border-parchment-border bg-muted/50 px-3 py-2 transition-colors hover:bg-accent"
                        href={`/words/${word.lexemeId}`}
                      >
                        <span className="font-display text-base">
                          {word.lemma}
                        </span>
                        <span aria-hidden className="text-accent-ochre">
                          →
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </SectionCard>
            )}
          </aside>
        </div>

        <footer className="flex flex-col gap-3">
          <Separator />
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            {detail.lexeme.dwdsUrl && (
              <a
                className="font-medium text-primary underline-offset-4 hover:underline"
                href={detail.lexeme.dwdsUrl}
                target="_blank"
                rel="noreferrer"
              >
                DWDS ↗
              </a>
            )}
            {detail.lexeme.dictionaryUrl && (
              <a
                className="font-medium text-primary underline-offset-4 hover:underline"
                href={detail.lexeme.dictionaryUrl}
                target="_blank"
                rel="noreferrer"
              >
                Wiktionary ↗
              </a>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {t.dataSources}: DWDS · FreeDictionaryAPI.com · OdeNet · wordfeather
            · OpenThesaurus · Tatoeba (CC BY 2.0 FR)
            {detail.wordnet?.source
              ? ` v${detail.wordnet.source.version} · ${detail.wordnet.source.license}`
              : ""}
          </p>
        </footer>
      </article>
    </WordTranslationProvider>
  );
}

function SectionCard({
  title,
  titleZh,
  meta,
  children,
}: {
  title: string;
  titleZh: string;
  meta?: string;
  children: ReactNode;
}) {
  return (
    <Card className="shadow-plate">
      <CardHeader className="border-b border-parchment-border pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="h-5 w-1.5 shrink-0 rounded-full bg-primary"
            />
            <CardTitle className="flex flex-wrap items-baseline gap-2">
              <span className="font-display text-xl font-semibold text-primary">
                {title}
              </span>
              <span className="text-sm font-normal text-muted-foreground">
                {titleZh}
              </span>
            </CardTitle>
          </div>
          {meta && (
            <span className="text-xs text-muted-foreground">{meta}</span>
          )}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

async function ExampleSentenceCard({
  lemma,
  forms,
  odenetExamples,
  t,
}: {
  lemma: string;
  forms: string[];
  odenetExamples: string[];
  t: Translation;
}) {
  const tatoeba = await getTatoebaSentences({
    lemma,
    forms,
    limit: 4,
  });
  const sentences = buildExampleSentences({
    tatoeba,
    odenet: odenetExamples,
    limit: 6,
  });

  if (sentences.length === 0) {
    return null;
  }

  return (
    <SectionCard
      title={t.sectionExamples}
      titleZh={t.sectionExamplesZh}
      meta={`${sentences.length} ${t.examplesCount}`}
    >
      <ExampleSentenceList
        sentences={sentences}
        labels={{
          pronounce: t.pronounce,
        }}
      />
    </SectionCard>
  );
}

async function SemanticNetwork({
  lexemeId,
  canonicalLemma,
  groups,
  t,
}: {
  lexemeId: string;
  canonicalLemma: string;
  groups: Array<{ title: string; words: WordnetRelatedWordLike[] }>;
  t: Translation;
}) {
  const thesaurus = await getOpenThesaurusSynonyms({
    id: lexemeId,
    canonicalLemma,
  });

  if (groups.length === 0 && thesaurus.length === 0) {
    return null;
  }

  return (
    <SectionCard
      title={t.sectionSemantic}
      titleZh={t.sectionSemanticZh}
      meta={t.semanticNetworkMeta}
    >
      <div className="flex flex-col gap-5">
        {groups.map((group, index) => (
          <div key={group.title} className="flex flex-col gap-2">
            {index > 0 && <Separator className="mb-1" />}
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {group.title}
            </h3>
            <ul className="flex flex-wrap gap-2">
              {group.words.slice(0, 24).map((word) => (
                <RelatedWordChip key={word.lemma} word={word} />
              ))}
            </ul>
          </div>
        ))}

        {thesaurus.length > 0 && (
          <div className="flex flex-col gap-2">
            {groups.length > 0 && <Separator className="mb-1" />}
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t.openThesaurusSynonyms}
            </h3>
            <ul className="flex flex-wrap gap-2">
              {thesaurus.map((word) => (
                <RelatedWordChip
                  key={word.normalizedLemma}
                  word={{
                    lemma: word.lemma,
                    partOfSpeech: null,
                    lexemeId: word.lexemeId,
                  }}
                />
              ))}
            </ul>
          </div>
        )}
      </div>
    </SectionCard>
  );
}

function RelatedWordChip({ word }: { word: WordnetRelatedWordLike }) {
  if (word.lexemeId) {
    return (
      <li>
        <Link
          className={badgeVariants({ variant: "secondary" })}
          href={`/words/${word.lexemeId}`}
        >
          {word.lemma}
        </Link>
      </li>
    );
  }

  return (
    <li>
      <Badge variant="outline">{word.lemma}</Badge>
    </li>
  );
}

function parseFormsJson(value: unknown): {
  genitive: string | null;
  plural: string | null;
  forms: Array<{
    word: string;
    tags: string[];
  }>;
} | null {
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

function WordDetailSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-72 rounded-xl" />
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="flex flex-col gap-6 lg:col-span-8">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
        <div className="flex flex-col gap-6 lg:col-span-4">
          <Skeleton className="h-56 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
