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
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { WordCard } from "@/components/word-card";
import { SpeakButton } from "@/components/speak-button";
import { WordNoteForm } from "@/components/word-note-form";
import { requireUser } from "@/lib/server/auth";
import { getUserWordDetail } from "@/lib/server/lexemes";
import { getDictionary } from "@/lib/i18n";
import type { WordnetRelatedWord } from "@/lib/server/wordnet";

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
  const germanDefinitions =
    detail.wordnet?.definitions
      .filter((definition) => definition.language === "de")
      .map((definition) => definition.text) ?? [];
  const englishDefinitions = Array.from(
    new Set([
      ...(detail.lexeme.definitionEn?.split("\n") ?? []),
      ...(detail.wordnet?.definitions
        .filter((definition) => definition.language === "en")
        .map((definition) => definition.text) ?? []),
    ]),
  ).filter(Boolean);
  const relationGroups = [
    {
      title: t.synonyms,
      words: detail.wordnet?.synonyms ?? [],
    },
    {
      title: t.antonyms,
      words: detail.wordnet?.antonyms ?? [],
    },
    {
      title: t.hypernyms,
      words: detail.wordnet?.hypernyms ?? [],
    },
    {
      title: t.hyponyms,
      words: detail.wordnet?.hyponyms ?? [],
    },
  ].filter((group) => group.words.length > 0);

  const reviewStatusLabel = {
    NEW: t.statusNew,
    LEARNING: t.statusLearning,
    REVIEWING: t.statusReviewing,
    MASTERED: t.statusMastered,
  }[detail.reviewStatus] ?? t.statusNew;

  return (
    <article className="word-card-theme mx-auto w-full max-w-6xl rounded-2xl bg-background p-4 text-foreground sm:p-6">
      <Link
        className="text-sm text-primary underline-offset-4 hover:underline"
        href="/dashboard"
      >
        ← {t.dashboard}
      </Link>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-6">
          <WordCard
            lexemeId={detail.lexeme.id}
            lemma={detail.lexeme.canonicalLemma}
            wordType={detail.lexeme.wordType}
            gender={detail.lexeme.gender}
            ipa={detail.lexeme.ipa}
            frequencyClass={detail.lexeme.frequencyClass}
            vocabularyLevels={detail.vocabularyLevels}
            genitive={forms?.genitive ?? null}
            plural={forms?.plural ?? null}
            encounterCount={detail.encounterCount}
            isFavorite={detail.isFavorite}
            labels={{
              pronounce: t.pronounce,
              favorite: t.favorite,
              favorited: t.favorited,
              frequency: t.frequency,
              genitive: t.genitive,
              plural: t.plural,
              encounterCount: t.encounterCount,
            }}
          />

          <ContentCard title={t.meaning}>
            {germanDefinitions.length > 0 && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t.germanLabel}
                </p>
                <ol className="mt-2 flex list-decimal flex-col gap-2 pl-5">
                  {germanDefinitions.map((definition) => (
                    <li key={definition}>{definition}</li>
                  ))}
                </ol>
              </div>
            )}

            {englishDefinitions.length > 0 && (
              <div className={germanDefinitions.length > 0 ? "mt-6" : ""}>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t.englishLabel}
                </p>
                <ol className="mt-2 flex list-decimal flex-col gap-2 pl-5 text-muted-foreground">
                  {englishDefinitions.map((definition) => (
                    <li key={definition}>{definition}</li>
                  ))}
                </ol>
              </div>
            )}

            {germanDefinitions.length === 0 &&
              englishDefinitions.length === 0 && (
                <p className="text-muted-foreground">{t.noDefinition}</p>
              )}
          </ContentCard>

          {relationGroups.length > 0 && (
            <ContentCard title={t.semanticRelations}>
              <div className="flex flex-col gap-6">
                {relationGroups.map((group, index) => (
                  <div key={group.title}>
                    {index > 0 && <Separator className="mb-6" />}
                    <h3 className="text-sm font-medium text-muted-foreground">
                      {group.title}
                    </h3>
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {group.words.slice(0, 24).map((word) => (
                        <RelatedWordChip
                          key={`${group.title}-${word.lemma}`}
                          word={word}
                        />
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </ContentCard>
          )}

          {forms && (
            <ContentCard title={t.wordForms}>
              <dl className="grid gap-4 sm:grid-cols-2">
                {forms.genitive && (
                  <div>
                    <dt className="text-sm text-muted-foreground">
                      {t.genitive}
                    </dt>
                    <dd className="mt-1">{forms.genitive}</dd>
                  </div>
                )}
                {forms.plural && (
                  <div>
                    <dt className="text-sm text-muted-foreground">
                      {t.plural}
                    </dt>
                    <dd className="mt-1">{forms.plural}</dd>
                  </div>
                )}
              </dl>

              {forms.forms.length > 0 && (
                <ul className="mt-5 flex flex-wrap gap-2">
                  {forms.forms.slice(0, 16).map((form, index) => (
                    <li key={`${form.word}-${form.tags.join("-")}-${index}`}>
                      <Badge variant="outline">
                        {form.word}
                        {form.tags.length > 0 && (
                          <span className="text-muted-foreground">
                            {form.tags.join(", ")}
                          </span>
                        )}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </ContentCard>
          )}

          {detail.wordnet && detail.wordnet.examples.length > 0 && (
            <ContentCard title={t.examples}>
              <ul className="flex flex-col gap-3">
                {detail.wordnet.examples.map((example) => (
                  <li key={example}>
                    <div className="flex items-start justify-between gap-3 border-l-2 border-primary/30 pl-4">
                      <p className="text-muted-foreground">{example}</p>
                      <SpeakButton text={example} label={t.pronounce} />
                    </div>
                  </li>
                ))}
              </ul>
            </ContentCard>
          )}

          <ContentCard title={t.learningRecord}>
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
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

            <h3 className="mt-6 text-sm font-medium text-muted-foreground">
              {t.surfaceForms}
            </h3>
            {surfaceFormCounts.size === 0 ? (
              <p className="mt-3 text-muted-foreground">—</p>
            ) : (
              <ul className="mt-3 flex flex-wrap gap-2">
                {Array.from(surfaceFormCounts.entries()).map(
                  ([surfaceForm, value]) => (
                    <li key={surfaceForm}>
                      <Badge variant="outline">
                        {surfaceForm}
                        <span className="text-muted-foreground">
                          ×{value.count}
                        </span>
                      </Badge>
                    </li>
                  ),
                )}
              </ul>
            )}
          </ContentCard>
        </div>

        <aside className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>{t.myNotes}</CardTitle>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t.reviewStatus}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{reviewStatusLabel}</Badge>
                <Badge variant="outline">
                  {t.leitnerBox} {detail.leitnerBox}
                </Badge>
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
                  <dd className="mt-1">{detail.encounterCount}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </aside>
      </div>

      <footer className="mt-8">
        <Separator />
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
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
        <p className="mt-2 text-xs text-muted-foreground">
          {t.dataSources}: DWDS · FreeDictionaryAPI.com · OdeNet · wordfeather
          {detail.wordnet?.source
            ? ` v${detail.wordnet.source.version} · ${detail.wordnet.source.license}`
            : ""}
        </p>
      </footer>
    </article>
  );
}

function ContentCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function RelatedWordChip({ word }: { word: WordnetRelatedWord }) {
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
    <div className="mx-auto w-full max-w-6xl">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-6 h-64 rounded-xl" />
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-6">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}
