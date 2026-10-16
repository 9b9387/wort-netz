import Link from "next/link";
import { Suspense, type ReactNode } from "react";
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
import { ExampleSentenceList } from "@/components/example-sentence-list";
import { WordHero } from "@/components/word-hero";
import { WordNoteForm } from "@/components/word-note-form";
import { WordLink } from "@/components/word-link";
import { AddToWordBookButton } from "@/components/add-to-word-book-button";
import { WordStatusButtons } from "@/components/word-status-buttons";
import {
  WordTranslationProvider,
  type TranslationLabels,
} from "@/components/word-translation";
import type { Translation } from "@/lib/i18n";
import { buildExampleSentences } from "@/lib/example-sentences";
import type { UserWordDetail } from "@/lib/server/lexemes";
import { getOpenThesaurusSynonyms } from "@/lib/server/openthesaurus";
import { getTatoebaSentences } from "@/lib/server/tatoeba";
import {
  buildWordDetailData,
  LEITNER_BOX_MAX,
  type RelationGroupKey,
} from "@/lib/word-detail-data";
import type { WordnetRelatedWordLike } from "@/lib/word-display";

export type WordDetailVariant = "page" | "panel";

const RELATION_LABELS: Record<RelationGroupKey, keyof Translation> = {
  synonyms: "synonyms",
  antonyms: "antonyms",
  hypernyms: "hypernyms",
  hyponyms: "hyponyms",
};

function reviewStatusLabel(status: string, t: Translation): string {
  return (
    {
      NEW: t.statusNew,
      LEARNING: t.statusLearning,
      REVIEWING: t.statusReviewing,
      MASTERED: t.statusMastered,
      SUSPENDED: t.statusSuspended,
    }[status] ?? t.statusNew
  );
}

function translationLabels(t: Translation): TranslationLabels {
  return {
    targetLabel: t.translationTargetLabel,
    enable: t.translationEnable,
    preparing: t.translationPreparing,
    unsupported: t.translationUnsupported,
    failed: t.translationFailed,
    retry: t.translationRetry,
  };
}

/**
 * The one place that renders a word entry. `page` keeps the full
 * `/words/[id]` layout; `panel` is the compact single-column version used in
 * the reader's detail pane.
 */
export function WordDetailView({
  detail,
  t,
  variant = "page",
  surfaceForm = null,
}: {
  detail: UserWordDetail;
  t: Translation;
  variant?: WordDetailVariant;
  /** Form as it appeared in the article, when opened from the reader. */
  surfaceForm?: string | null;
}) {
  return (
    <WordTranslationProvider>
      {variant === "panel" ? (
        <WordDetailPanel detail={detail} t={t} surfaceForm={surfaceForm} />
      ) : (
        <WordDetailPageBody detail={detail} t={t} surfaceForm={surfaceForm} />
      )}
    </WordTranslationProvider>
  );
}

function WordHeroSection({
  detail,
  t,
  data,
  compact,
  surfaceForm,
}: {
  detail: UserWordDetail;
  t: Translation;
  data: ReturnType<typeof buildWordDetailData>;
  compact: boolean;
  surfaceForm: string | null;
}) {
  return (
    <WordHero
      compact={compact}
      surfaceForm={surfaceForm}
      lexemeId={detail.lexeme.id}
      lemma={detail.lexeme.canonicalLemma}
      wordType={detail.lexeme.wordType}
      gender={detail.lexeme.gender}
      ipa={detail.lexeme.ipa}
      frequencyClass={
        detail.lexeme.frequencyClass && detail.lexeme.frequencyClass > 0
          ? detail.lexeme.frequencyClass
          : null
      }
      vocabularyLevels={detail.vocabularyLevels}
      genitive={data.forms?.genitive ?? null}
      plural={data.forms?.plural ?? null}
      isFavorite={detail.isFavorite}
      germanDefinitions={data.germanDefinitions}
      englishSenses={data.englishSenses}
      t={t}
      definitionLabel={t.definitionDe}
      englishGlossLabels={{
        title: t.englishGlossTitle,
        enable: t.translationEnable,
        preparing: t.translationPreparing,
        unsupported: t.englishGlossUnsupported,
        enableHint: t.englishGlossEnableHint,
        failed: t.translationFailed,
        retry: t.translationRetry,
      }}
      frequencyLabel={t.frequencyClassLabel}
      genitiveLabel={t.genitive}
      pluralLabel={t.plural}
      lemmaLabel={t.lemmaLabel}
      labels={{
        pronounce: t.pronounce,
        favorite: t.favorite,
        favorited: t.favorited,
      }}
      actions={
        <>
          <AddToWordBookButton
            lexemeId={detail.lexeme.id}
            surfaceForm={surfaceForm ?? detail.lexeme.canonicalLemma}
            inWordBook={detail.encounterCount > 0}
          />
          <WordStatusButtons
            lexemeId={detail.lexeme.id}
            status={detail.reviewStatus}
          />
        </>
      }
      translationLabels={translationLabels(t)}
    />
  );
}

function WordFormsSection({
  data,
  t,
  wordType,
}: {
  data: ReturnType<typeof buildWordDetailData>;
  t: Translation;
  wordType: string | null;
}) {
  const forms = data.forms;

  if (!forms || (!forms.genitive && !forms.plural && forms.forms.length === 0)) {
    return null;
  }

  return (
    <SectionCard
      title={t.sectionForms}
      titleZh={t.sectionFormsZh}
      meta={wordType ?? undefined}
    >
      <div className="flex flex-col gap-5">
        <dl className="grid gap-4 sm:grid-cols-2">
          {forms.genitive && (
            <div className="rounded-lg border border-parchment-border bg-muted/60 p-3">
              <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t.genitive}
              </dt>
              <dd className="mt-1 font-display text-lg">
                <WordLink surface={forms.genitive} />
              </dd>
            </div>
          )}
          {forms.plural && (
            <div className="rounded-lg border border-parchment-border bg-muted/60 p-3">
              <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t.plural}
              </dt>
              <dd className="mt-1 font-display text-lg">
                <WordLink surface={forms.plural} />
              </dd>
            </div>
          )}
        </dl>

        {data.normalizedForms.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {data.normalizedForms.map((form) => (
              <li key={form.word}>
                <Badge variant="outline">
                  <WordLink surface={form.word} />
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
  );
}

function NotesSection({
  detail,
  t,
}: {
  detail: UserWordDetail;
  t: Translation;
}) {
  return (
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
  );
}

function SrsSection({
  detail,
  t,
  dateFormatter,
}: {
  detail: UserWordDetail;
  t: Translation;
  dateFormatter: Intl.DateTimeFormat;
}) {
  return (
    <SectionCard title={t.sectionSrs} titleZh={t.sectionSrsZh}>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">
            {reviewStatusLabel(detail.reviewStatus, t)}
          </Badge>
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
            <dt className="text-muted-foreground">{t.totalEncounters}</dt>
            <dd className="mt-1 font-display text-lg">
              {detail.encounterCount}
            </dd>
          </div>
        </dl>
      </div>
    </SectionCard>
  );
}

function LogSection({
  detail,
  t,
  dateFormatter,
  surfaceFormCounts,
}: {
  detail: UserWordDetail;
  t: Translation;
  dateFormatter: Intl.DateTimeFormat;
  surfaceFormCounts: ReturnType<typeof buildWordDetailData>["surfaceFormCounts"];
}) {
  return (
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
          {surfaceFormCounts.length === 0 ? (
            <p className="text-muted-foreground">—</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {surfaceFormCounts.map((item) => (
                <li key={item.surfaceForm}>
                  <Badge variant="outline">
                    {item.surfaceForm}
                    <span className="font-code text-muted-foreground">
                      ×{item.count}
                    </span>
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t.reviewLogTitle}
          </span>
          {detail.recentReviews.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.reviewLogEmpty}</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {detail.recentReviews.map((review) => (
                <li
                  key={review.id}
                  className="flex flex-wrap items-center gap-2"
                >
                  <Badge
                    variant={
                      review.rating === "KNOWN" ? "secondary" : "outline"
                    }
                  >
                    {review.rating === "KNOWN"
                      ? t.reviewLogKnown
                      : t.reviewLogForgot}
                  </Badge>
                  <span className="font-code text-xs text-muted-foreground">
                    {t.leitnerBox} {review.boxBefore} → {review.boxAfter}
                  </span>
                  {review.intervalDaysAfter > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {t.reviewLogInterval.replace(
                        "{days}",
                        String(review.intervalDaysAfter),
                      )}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {dateFormatter.format(new Date(review.reviewedAt))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </SectionCard>
  );
}

function SourceLinks({ detail }: { detail: UserWordDetail }) {
  return (
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
  );
}

function DataSources({ detail, t }: { detail: UserWordDetail; t: Translation }) {
  return (
    <p className="text-xs text-muted-foreground">
      {t.dataSources}: DWDS · FreeDictionaryAPI.com · OdeNet · wordfeather ·
      OpenThesaurus · Tatoeba (CC BY 2.0 FR)
      {detail.wordnet?.source
        ? ` v${detail.wordnet.source.version} · ${detail.wordnet.source.license}`
        : ""}
    </p>
  );
}

/**
 * Multi-word expressions come from three sources: OdeNet (German definitions),
 * wordfeather (English gloss + example) and the curated list (Chinese gloss).
 * Whatever the source provided is shown here, right under the word card.
 */
/**
 * Entries stored as an inflected form ("ist") point at the lemma they belong to
 * ("sein"), which carries the definitions and examples.
 */
function FormBaseBanner({
  detail,
  t,
}: {
  detail: UserWordDetail;
  t: Translation;
}) {
  if (!detail.baseLexeme) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-ochre-border bg-ochre-muted px-3 py-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-ochre-foreground">
        {t.lemmaLabel}
      </span>
      <Link
        href={`/words/${detail.baseLexeme.id}`}
        className="font-display text-lg text-primary underline-offset-4 hover:underline"
      >
        {detail.baseLexeme.canonicalLemma} →
      </Link>
      <span className="text-xs text-muted-foreground">{t.formEntryHint}</span>
    </div>
  );
}

function PhraseGlossBlock({
  detail,
  t,
}: {
  detail: UserWordDetail;
  t: Translation;
}) {
  const source = detail.lexeme.sourceJson as
    | { kind?: string; gloss?: string | null; example?: string | null }
    | null;

  if (!source || source.kind !== "phrase") {
    return null;
  }

  if (!source.gloss && !source.example) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-ochre-border bg-ochre-muted p-3 sm:p-4">
      {source.gloss && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-ochre-foreground">
            {t.phraseGlossLabel}
          </span>
          <p className="font-display text-lg leading-7 text-foreground">
            {source.gloss}
          </p>
        </div>
      )}

      {source.example && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-ochre-foreground">
            {t.phraseExampleLabel}
          </span>
          <p className="font-display text-base italic leading-7 text-ink-secondary">
            {source.example}
          </p>
        </div>
      )}
    </div>
  );
}

function WordDetailPageBody({
  detail,
  t,
  surfaceForm,
}: {
  detail: UserWordDetail;
  t: Translation;
  surfaceForm: string | null;
}) {
  const data = buildWordDetailData(detail);
  const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <article className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <WordHeroSection
        detail={detail}
        t={t}
        data={data}
        compact={false}
        surfaceForm={surfaceForm}
      />
      <FormBaseBanner detail={detail} t={t} />
      <PhraseGlossBlock detail={detail} t={t} />

      <div className="grid items-start gap-6 lg:grid-cols-12">
        <main className="flex flex-col gap-6 lg:col-span-8">
          <WordFormsSection
            data={data}
            t={t}
            wordType={detail.lexeme.wordType}
          />

          <Suspense fallback={<Skeleton className="h-48 rounded-xl" />}>
            <ExampleSentenceCard
              lemma={detail.lexeme.canonicalLemma}
              forms={data.normalizedForms.map((form) => form.word)}
              odenetExamples={detail.wordnet?.examples ?? []}
              t={t}
              limit={6}
            />
          </Suspense>

          <NotesSection detail={detail} t={t} />
        </main>

        <aside className="flex flex-col gap-6 lg:col-span-4">
          <SrsSection detail={detail} t={t} dateFormatter={dateFormatter} />
          <LogSection
            detail={detail}
            t={t}
            dateFormatter={dateFormatter}
            surfaceFormCounts={data.surfaceFormCounts}
          />

          <Suspense fallback={<Skeleton className="h-40 rounded-xl" />}>
            <SemanticNetwork
              lexemeId={detail.lexeme.id}
              canonicalLemma={detail.lexeme.canonicalLemma}
              groups={data.relationGroups}
              t={t}
            />
          </Suspense>

          {data.relatedWords.length > 0 && (
            <SectionCard title={t.sectionRelated} titleZh={t.sectionRelatedZh}>
              <ul className="flex flex-col gap-2">
                {data.relatedWords.map((word) => (
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
        <SourceLinks detail={detail} />
        <DataSources detail={detail} t={t} />
      </footer>
    </article>
  );
}

function WordDetailPanel({
  detail,
  t,
  surfaceForm,
}: {
  detail: UserWordDetail;
  t: Translation;
  surfaceForm: string | null;
}) {
  const data = buildWordDetailData(detail);
  const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="flex flex-col gap-4">
      <WordHeroSection
        detail={detail}
        t={t}
        data={data}
        compact
        surfaceForm={surfaceForm}
      />
      <FormBaseBanner detail={detail} t={t} />
      <PhraseGlossBlock detail={detail} t={t} />

      <Suspense fallback={<Skeleton className="h-32 rounded-xl" />}>
        <ExampleSentenceCard
          lemma={detail.lexeme.canonicalLemma}
          forms={data.normalizedForms.map((form) => form.word)}
          odenetExamples={detail.wordnet?.examples ?? []}
          t={t}
          limit={6}
        />
      </Suspense>

      <WordFormsSection data={data} t={t} wordType={detail.lexeme.wordType} />

      <Suspense fallback={<Skeleton className="h-40 rounded-xl" />}>
        <SemanticNetwork
          lexemeId={detail.lexeme.id}
          canonicalLemma={detail.lexeme.canonicalLemma}
          groups={data.relationGroups}
          t={t}
        />
      </Suspense>

      {data.relatedWords.length > 0 && (
        <SectionCard title={t.sectionRelated} titleZh={t.sectionRelatedZh}>
          <ul className="flex flex-col gap-2">
            {data.relatedWords.map((word) => (
              <li key={word.lexemeId}>
                <WordLink
                  surface={word.lemma}
                  lexemeId={word.lexemeId}
                  className="flex items-center justify-between gap-3 rounded-lg border border-parchment-border bg-muted/50 px-3 py-2 no-underline transition-colors hover:bg-accent"
                >
                  <span className="font-display text-base">{word.lemma}</span>
                  <span aria-hidden className="text-accent-ochre">
                    →
                  </span>
                </WordLink>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      <NotesSection detail={detail} t={t} />

      <SrsSection detail={detail} t={t} dateFormatter={dateFormatter} />

      <LogSection
        detail={detail}
        t={t}
        dateFormatter={dateFormatter}
        surfaceFormCounts={data.surfaceFormCounts}
      />

      <Separator />

      <div className="flex flex-col gap-3">
        <Link
          className="font-medium text-primary text-sm underline-offset-4 hover:underline"
          href={`/words/${detail.lexeme.id}`}
        >
          {t.readerOpenFullEntry} ↗
        </Link>
        <SourceLinks detail={detail} />
        <DataSources detail={detail} t={t} />
      </div>
    </div>
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
          {meta && <span className="text-xs text-muted-foreground">{meta}</span>}
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
  limit,
}: {
  lemma: string;
  forms: string[];
  odenetExamples: string[];
  t: Translation;
  limit: number;
}) {
  const tatoeba = await getTatoebaSentences({
    lemma,
    forms,
    limit: Math.min(limit, 4),
  });
  const sentences = buildExampleSentences({
    tatoeba,
    odenet: odenetExamples,
    limit,
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
  groups: ReturnType<typeof buildWordDetailData>["relationGroups"];
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
          <div key={group.key} className="flex flex-col gap-2">
            {index > 0 && <Separator className="mb-1" />}
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t[RELATION_LABELS[group.key]]}
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
  return (
    <li>
      <WordLink
        surface={word.lemma}
        lexemeId={word.lexemeId}
        className={badgeVariants({
          variant: word.lexemeId ? "secondary" : "outline",
        })}
      />
    </li>
  );
}
