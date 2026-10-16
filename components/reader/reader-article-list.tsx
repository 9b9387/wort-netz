"use client";

import { EllipsisVerticalIcon, PlusIcon, TrashIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";
import type { Translation } from "@/lib/i18n";

export type ReaderArticleSummaryDto = {
  id: string;
  excerpt: string;
  charCount: number;
  /** Unlearned words from the last annotation; null until the article is opened. */
  unlearnedCount: number | null;
  updatedAt: string;
};

function formatDate(iso: string): string {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
  }).format(date);
}

export function ReaderArticleList({
  articles,
  activeId,
  onSelect,
  onNew,
  onDelete,
  t,
}: {
  articles: readonly ReaderArticleSummaryDto[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  t: Translation;
}) {
  return (
    <Card className="flex h-full min-h-0 flex-col shadow-plate">
      <CardContent className="flex min-h-0 flex-1 flex-col gap-3 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="font-display text-base font-semibold text-primary">
            {t.readerListTitle}
          </span>
          <Button size="sm" onClick={onNew}>
            <PlusIcon data-icon="inline-start" />
            {t.readerNewArticle}
          </Button>
        </div>

        {articles.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <PlusIcon />
              </EmptyMedia>
              <EmptyTitle>{t.readerNewArticle}</EmptyTitle>
              <EmptyDescription>{t.readerEmptyList}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
            {articles.map((article) => {
              const isActive = article.id === activeId;

              return (
                <li key={article.id}>
                  <div
                    className={cn(
                      "group flex items-start gap-1 rounded-lg border border-transparent px-2 py-2 transition-colors",
                      isActive
                        ? "border-parchment-border bg-accent"
                        : "hover:bg-muted/60",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onSelect(article.id)}
                      className="flex min-w-0 flex-1 flex-col items-start gap-1.5 text-left"
                    >
                      <span className="line-clamp-2 text-sm leading-5">
                        {article.excerpt}
                      </span>
                      <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatDate(article.updatedAt)}</span>
                        {article.unlearnedCount !== null && (
                          <Badge
                            variant="outline"
                            className="border-status-unlearned-border bg-status-unlearned-muted font-code text-status-unlearned-foreground"
                          >
                            {t.readerCategoryUnlearned} {article.unlearnedCount}
                          </Badge>
                        )}
                      </span>
                    </button>

                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={t.readerDelete}
                          />
                        }
                      >
                        <EllipsisVerticalIcon />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onSelect(article.id)}>
                          {t.readerOpenArticle}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => onDelete(article.id)}
                        >
                          <TrashIcon data-icon="inline-start" />
                          {t.readerDelete}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
