import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

function safeHref(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split(
    /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g,
  );

  return parts.map((part, index) => {
    const key = `${keyPrefix}-${index}`;

    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }

    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code
          key={key}
          className="rounded bg-muted px-1 py-0.5 font-code text-[0.9em]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);

    if (link) {
      const href = safeHref(link[2]);

      if (href) {
        return (
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            {link[1]}
          </a>
        );
      }
    }

    return <span key={key}>{part}</span>;
  });
}

function renderLines(lines: string[], keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let code: { language: string; lines: string[] } | null = null;

  const flushParagraph = (index: number) => {
    if (paragraph.length === 0) {
      return;
    }

    const text = paragraph.join(" ");
    nodes.push(
      <p key={`${keyPrefix}-p-${index}`}>{renderInline(text, `${keyPrefix}-p-${index}`)}</p>,
    );
    paragraph = [];
  };

  const flushList = (index: number) => {
    if (!list || list.items.length === 0) {
      list = null;
      return;
    }

    const ListTag = list.ordered ? "ol" : "ul";
    nodes.push(
      <ListTag
        key={`${keyPrefix}-list-${index}`}
        className={cn(
          "flex flex-col gap-1.5 pl-5",
          list.ordered ? "list-decimal" : "list-disc",
        )}
      >
        {list.items.map((item, itemIndex) => (
          <li key={`${keyPrefix}-list-${index}-${itemIndex}`}>
            {renderInline(item, `${keyPrefix}-list-${index}-${itemIndex}`)}
          </li>
        ))}
      </ListTag>,
    );
    list = null;
  };

  const flushAll = (index: number) => {
    flushParagraph(index);
    flushList(index);
  };

  lines.forEach((line, index) => {
    if (line.trim().startsWith("```")) {
      flushAll(index);

      if (code) {
        nodes.push(
          <pre
            key={`${keyPrefix}-code-${index}`}
            className="overflow-x-auto rounded-lg bg-muted p-3 font-code text-xs"
          >
            <code>{code.lines.join("\n")}</code>
          </pre>,
        );
        code = null;
      } else {
        code = {
          language: line.trim().slice(3).trim(),
          lines: [],
        };
      }

      return;
    }

    if (code) {
      code.lines.push(line);
      return;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);

    if (heading) {
      flushAll(index);
      const level = heading[1].length;
      const HeadingTag = level === 1 ? "h2" : level === 2 ? "h3" : "h4";
      const headingClass =
        level === 1
          ? "mt-2 font-heading text-lg font-semibold"
          : level === 2
            ? "mt-2 font-heading text-base font-semibold"
            : "mt-1 font-heading text-sm font-semibold";
      nodes.push(
        <HeadingTag
          key={`${keyPrefix}-heading-${index}`}
          className={headingClass}
        >
          {renderInline(heading[2], `${keyPrefix}-heading-${index}`)}
        </HeadingTag>,
      );
      return;
    }

    const unordered = line.match(/^\s*[-*]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);

    if (unordered || ordered) {
      flushParagraph(index);
      const nextOrdered = Boolean(ordered);

      if (!list || list.ordered !== nextOrdered) {
        flushList(index);
        list = { ordered: nextOrdered, items: [] };
      }

      list.items.push((unordered?.[1] ?? ordered?.[1]) ?? "");
      return;
    }

    if (!line.trim()) {
      flushAll(index);
      return;
    }

    paragraph.push(line.trim());
  });

  flushAll(lines.length);
  return nodes;
}

export function MarkdownContent({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  return (
    <div
      data-slot="markdown-content"
      className={cn(
        "flex flex-col gap-2.5 text-sm leading-6 text-foreground/90",
        className,
      )}
    >
      {renderLines(content.split(/\r?\n/), "markdown")}
    </div>
  );
}
