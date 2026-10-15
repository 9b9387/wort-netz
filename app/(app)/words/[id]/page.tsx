import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import {
  ArrowLeftIcon,
  BookOpenTextIcon,
  ExternalLinkIcon,
} from "lucide-react";
import { requireUser } from "@/lib/server/auth";
import { getUserWordDetail } from "@/lib/server/lexemes";
import { getDictionary } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";

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

  return (
    <article className="mx-auto w-full max-w-4xl">
      <Link
        className={buttonVariants({ variant: "link", size: "sm" })}
        href="/dashboard"
      >
        <ArrowLeftIcon data-icon="inline-start" />
        {t.dashboard}
      </Link>

      <Card className="mt-6">
        <CardHeader>
          <CardAction>
            <div className="flex flex-col items-center rounded-lg bg-muted px-5 py-3">
              <span className="text-xs text-muted-foreground">
                {t.encounterCount}
              </span>
              <span className="font-heading text-3xl font-semibold">
                {detail.encounterCount}
              </span>
            </div>
          </CardAction>
          <CardTitle className="text-4xl">
            {detail.lexeme.canonicalLemma}
          </CardTitle>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {detail.lexeme.wordType && (
              <Badge variant="secondary">{detail.lexeme.wordType}</Badge>
            )}
            {detail.lexeme.frequencyClass !== null && (
              <Badge variant="outline">
                {t.frequency} {detail.lexeme.frequencyClass}/6
              </Badge>
            )}
            {detail.lexeme.ipa && (
              <Badge variant="secondary">/{detail.lexeme.ipa}/</Badge>
            )}
          </div>
        </CardHeader>

        <CardContent>
          <dl className="grid gap-5 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted-foreground">{t.firstSeen}</dt>
              <dd className="mt-1">
                {dateFormatter.format(new Date(detail.firstSeenAt))}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">{t.lastSeen}</dt>
              <dd className="mt-1">
                {dateFormatter.format(new Date(detail.lastSeenAt))}
              </dd>
            </div>
          </dl>

          {detail.lexeme.dwdsUrl && (
            <a
              className={buttonVariants({ variant: "link", size: "sm" })}
              href={detail.lexeme.dwdsUrl}
              target="_blank"
              rel="noreferrer"
            >
              {t.dwdsLink}
              <ExternalLinkIcon data-icon="inline-end" />
            </a>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>{t.englishMeaning}</CardTitle>
        </CardHeader>
        <CardContent>
          {detail.lexeme.definitionEn ? (
            <ol className="flex list-decimal flex-col gap-2 pl-5">
              {detail.lexeme.definitionEn.split("\n").map((definition) => (
                <li key={definition}>{definition}</li>
              ))}
            </ol>
          ) : (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <BookOpenTextIcon />
                </EmptyMedia>
                <EmptyTitle>{t.noDefinition}</EmptyTitle>
                <EmptyDescription>
                  该词条目前没有可展示的英文释义。
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}

          {detail.lexeme.dictionaryUrl && (
            <a
              className={buttonVariants({ variant: "link", size: "sm" })}
              href={detail.lexeme.dictionaryUrl}
              target="_blank"
              rel="noreferrer"
            >
              {t.wiktionaryLink}
              <ExternalLinkIcon data-icon="inline-end" />
            </a>
          )}

          {detail.lexeme.dictionarySource && (
            <p className="mt-4 text-xs text-muted-foreground">
              {detail.lexeme.dictionarySource}
              {detail.lexeme.dictionaryLicense
                ? ` · ${detail.lexeme.dictionaryLicense}`
                : ""}
            </p>
          )}
        </CardContent>
      </Card>

      {forms && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>{t.wordForms}</CardTitle>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>{t.surfaceForms}</CardTitle>
        </CardHeader>
        <CardContent>
          {surfaceFormCounts.size === 0 ? (
            <p className="text-muted-foreground">—</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
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
        </CardContent>
      </Card>
    </article>
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
    <div className="mx-auto w-full max-w-4xl">
      <Skeleton className="h-8 w-24" />
      <Skeleton className="mt-6 h-64 rounded-xl" />
      <Skeleton className="mt-6 h-40 rounded-xl" />
      <Skeleton className="mt-6 h-32 rounded-xl" />
    </div>
  );
}
