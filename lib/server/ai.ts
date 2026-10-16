import "server-only";

import { prisma } from "@/lib/prisma";
import {
  DEFAULT_ASSISTANT_SYSTEM_PROMPT,
  type LlmChatMessage,
} from "@/lib/server/llm";
import {
  getWordnetContentForLexeme,
  type WordnetContent,
} from "@/lib/server/wordnet";
import { getVocabularyLevelsForLexeme } from "@/lib/server/vocabulary-levels";

const MAX_THREAD_MESSAGES = 80;

export type AiMessageDto = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
};

export type AiThreadDto = {
  id: string;
  lexemeId: string | null;
  kind: string;
  title: string | null;
  lastMessageAt: Date;
};

export type AiThreadWithMessages = {
  thread: AiThreadDto;
  messages: AiMessageDto[];
};

export type AiWordIntroContext = {
  lexeme: {
    id: string;
    canonicalLemma: string;
    normalizedLemma: string;
    wordType: string | null;
    gender: string | null;
    ipa: string | null;
    frequencyClass: number | null;
    definitionEn: string | null;
  };
  wordnet: WordnetContent | null;
  vocabularyLevels: Array<{
    level: string;
    source: string;
  }>;
};

function toThreadDto(thread: {
  id: string;
  lexemeId: string | null;
  kind: string;
  title: string | null;
  lastMessageAt: Date;
}): AiThreadDto {
  return {
    id: thread.id,
    lexemeId: thread.lexemeId,
    kind: thread.kind,
    title: thread.title,
    lastMessageAt: thread.lastMessageAt,
  };
}

function isAiRole(value: string): value is "user" | "assistant" {
  return value === "user" || value === "assistant";
}

export async function getOrCreateAiThread(
  userId: string,
  input: {
    threadId?: string | null;
    lexemeId?: string | null;
    kind?: "general" | "word" | "grammar";
  },
): Promise<AiThreadDto> {
  if (input.threadId) {
    const thread = await prisma.aiThread.findFirst({
      where: {
        id: input.threadId,
        userId,
      },
      select: {
        id: true,
        lexemeId: true,
        kind: true,
        title: true,
        lastMessageAt: true,
      },
    });

    if (thread) {
      return toThreadDto(thread);
    }
  }

  const existing = await prisma.aiThread.findFirst({
    where: {
      userId,
      ...(input.lexemeId ? { lexemeId: input.lexemeId } : { lexemeId: null }),
      kind: input.kind ?? "general",
    },
    orderBy: {
      lastMessageAt: "desc",
    },
    select: {
      id: true,
      lexemeId: true,
      kind: true,
      title: true,
      lastMessageAt: true,
    },
  });

  if (existing) {
    return toThreadDto(existing);
  }

  const thread = await prisma.aiThread.create({
    data: {
      userId,
      lexemeId: input.lexemeId ?? null,
      kind: input.kind ?? "general",
    },
    select: {
      id: true,
      lexemeId: true,
      kind: true,
      title: true,
      lastMessageAt: true,
    },
  });

  return toThreadDto(thread);
}

export async function getAiThreadWithMessages(
  userId: string,
  threadId: string,
): Promise<AiThreadWithMessages | null> {
  const thread = await prisma.aiThread.findFirst({
    where: {
      id: threadId,
      userId,
    },
    select: {
      id: true,
      lexemeId: true,
      kind: true,
      title: true,
      lastMessageAt: true,
      messages: {
        orderBy: {
          createdAt: "desc",
        },
        take: MAX_THREAD_MESSAGES,
        select: {
          id: true,
          role: true,
          content: true,
          createdAt: true,
        },
      },
    },
  });

  if (!thread) {
    return null;
  }

  return {
    thread: toThreadDto(thread),
    messages: [...thread.messages]
      .reverse()
      .filter((message) => isAiRole(message.role))
      .map((message) => ({
        id: message.id,
        role: message.role as "user" | "assistant",
        content: message.content,
        createdAt: message.createdAt,
      })),
  };
}

export async function getLatestAiThread(
  userId: string,
  lexemeId: string | null,
): Promise<AiThreadDto | null> {
  const thread = await prisma.aiThread.findFirst({
    where: {
      userId,
      lexemeId,
    },
    orderBy: {
      lastMessageAt: "desc",
    },
    select: {
      id: true,
      lexemeId: true,
      kind: true,
      title: true,
      lastMessageAt: true,
    },
  });

  return thread ? toThreadDto(thread) : null;
}

export async function createAiMessage(
  userId: string,
  input: {
    threadId: string;
    role: "user" | "assistant";
    content: string;
    model?: string | null;
    configHash?: string | null;
  },
): Promise<AiMessageDto> {
  return prisma.$transaction(async (tx) => {
    const thread = await tx.aiThread.findFirst({
      where: {
        id: input.threadId,
        userId,
      },
      select: {
        id: true,
      },
    });

    if (!thread) {
      throw new Error("AI thread not found.");
    }

    const message = await tx.aiMessage.create({
      data: {
        userId,
        threadId: input.threadId,
        role: input.role,
        content: input.content,
        model: input.model ?? null,
        configHash: input.configHash ?? null,
      },
      select: {
        id: true,
        role: true,
        content: true,
        createdAt: true,
      },
    });

    await tx.aiThread.update({
      where: {
        id: input.threadId,
      },
      data: {
        lastMessageAt: new Date(),
      },
    });

    return {
      id: message.id,
      role: message.role as "user" | "assistant",
      content: message.content,
      createdAt: message.createdAt,
    };
  });
}

export async function deleteAiThread(
  userId: string,
  threadId: string,
): Promise<void> {
  await prisma.aiThread.deleteMany({
    where: {
      id: threadId,
      userId,
    },
  });
}

export async function getAiWordIntroContext(
  lexemeId: string,
): Promise<AiWordIntroContext | null> {
  const lexeme = await prisma.lexeme.findUnique({
    where: { id: lexemeId },
    select: {
      id: true,
      canonicalLemma: true,
      normalizedLemma: true,
      wordType: true,
      gender: true,
      ipa: true,
      frequencyClass: true,
      definitionEn: true,
    },
  });

  if (!lexeme) {
    return null;
  }

  const [wordnet, vocabularyLevels] = await Promise.all([
    getWordnetContentForLexeme(lexeme),
    getVocabularyLevelsForLexeme(lexeme.id),
  ]);

  return {
    lexeme,
    wordnet,
    vocabularyLevels: vocabularyLevels.map((level) => ({
      level: level.level,
      source: level.source,
    })),
  };
}

function contextLines(context: AiWordIntroContext): string[] {
  const lines = [
    `单词：${context.lexeme.canonicalLemma}`,
    `词性：${context.lexeme.wordType ?? "未知"}`,
  ];

  if (context.lexeme.gender) {
    lines.push(`词性/性别：${context.lexeme.gender}`);
  }

  if (context.lexeme.ipa) {
    lines.push(`IPA：/${context.lexeme.ipa}/`);
  }

  if (context.lexeme.frequencyClass !== null) {
    lines.push(`DWDS 频率等级：${context.lexeme.frequencyClass}/6`);
  }

  if (context.lexeme.definitionEn) {
    lines.push(`英文释义：${context.lexeme.definitionEn}`);
  }

  const germanDefinitions =
    context.wordnet?.definitions
      .filter((definition) => definition.language === "de")
      .map((definition) => definition.text) ?? [];

  if (germanDefinitions.length > 0) {
    lines.push(`德语释义：${germanDefinitions.join("；")}`);
  }

  const examples = context.wordnet?.examples ?? [];

  if (examples.length > 0) {
    lines.push(`已有例句：${examples.slice(0, 4).join(" | ")}`);
  }

  const synonyms = context.wordnet?.synonyms ?? [];

  if (synonyms.length > 0) {
    lines.push(
      `已有近义词：${synonyms
        .slice(0, 12)
        .map((word) => word.lemma)
        .join(", ")}`,
    );
  }

  if (context.vocabularyLevels.length > 0) {
    lines.push(
      `词汇等级：${context.vocabularyLevels
        .map((level) => level.level)
        .join(", ")}`,
    );
  }

  return lines;
}

export function buildWordIntroMessages(
  context: AiWordIntroContext,
): LlmChatMessage[] {
  return [
    {
      role: "system",
      content: [
        DEFAULT_ASSISTANT_SYSTEM_PROMPT,
        "你正在为德语学习者生成单词学习卡片。",
        "只根据给定上下文和可靠的德语知识回答，不要编造词源或用法。",
        "输出 Markdown，不要使用一级标题。",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        "请为下面这个词生成学习讲解。",
        "使用这些二级标题：## 一句话理解、## 核心用法、## 常见搭配、## 例句、## 记忆提示、## 易错点。",
        "例句必须给出德语原句和中文翻译。",
        "",
        contextLines(context).join("\n"),
      ].join("\n"),
    },
  ];
}

export function buildAssistantSystemPrompt(
  context: AiWordIntroContext | null,
): string {
  if (!context) {
    return DEFAULT_ASSISTANT_SYSTEM_PROMPT;
  }

  return [
    DEFAULT_ASSISTANT_SYSTEM_PROMPT,
    "当前用户正在查看下面的词条，回答时可以自然使用这些上下文：",
    contextLines(context).join("\n"),
  ].join("\n");
}
