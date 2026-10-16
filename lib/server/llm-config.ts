import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";

const ENCRYPTION_KEY_ENV = "LLM_CONFIG_ENCRYPTION_KEY";
const KEY_VERSION = 1;

export const DEFAULT_LLM_BASE_URL =
  process.env.LLM_DEFAULT_BASE_URL ?? "https://api.openai.com/v1";
export const DEFAULT_LLM_MODEL =
  process.env.LLM_DEFAULT_MODEL ?? "gpt-4o-mini";
export const DEFAULT_LLM_TEMPERATURE = parseNumberEnv(
  process.env.LLM_DEFAULT_TEMPERATURE,
  0.4,
);
export const DEFAULT_LLM_MAX_TOKENS = parseIntEnv(
  process.env.LLM_DEFAULT_MAX_TOKENS,
  4096,
);
export const DEFAULT_LLM_TIMEOUT_MS = parseIntEnv(
  process.env.LLM_REQUEST_TIMEOUT_MS,
  60_000,
);

export type LlmConfigStatus = {
  configured: boolean;
  baseUrl: string;
  model: string;
};

export type LlmRuntimeConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
};

export type SaveLlmConfigInput = {
  baseUrl: string;
  apiKey?: string;
  model: string;
  temperature?: number | null;
  maxTokens?: number | null;
  timeoutMs?: number | null;
};

export class LlmConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmConfigError";
  }
}

function parseNumberEnv(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseIntEnv(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function encryptionKey(): Buffer {
  const raw = process.env[ENCRYPTION_KEY_ENV];

  if (!raw) {
    throw new LlmConfigError(
      `${ENCRYPTION_KEY_ENV} is required to store LLM API keys.`,
    );
  }

  const key = Buffer.from(raw, "base64");

  if (key.length !== 32) {
    throw new LlmConfigError(
      `${ENCRYPTION_KEY_ENV} must be a base64-encoded 32-byte key.`,
    );
  }

  return key;
}

export function hasLlmEncryptionKey(): boolean {
  try {
    encryptionKey();
    return true;
  } catch {
    return false;
  }
}

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split(".").map((part) => Number(part));

  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return false;
  }

  return (
    parts[0] === 10 ||
    parts[0] === 127 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168)
  );
}

function isPrivateHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");

  if (
    normalized === "localhost" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:")
  ) {
    return true;
  }

  return isPrivateIpv4(normalized);
}

export function normalizeLlmBaseUrl(input: string): string {
  const value = input.trim();

  if (!value) {
    throw new LlmConfigError("baseUrl is required.");
  }

  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new LlmConfigError("baseUrl must be a valid URL.");
  }

  const isDevelopment = process.env.NODE_ENV !== "production";
  const isLocalDevelopmentHttp =
    isDevelopment &&
    url.protocol === "http:" &&
    (url.hostname === "localhost" || url.hostname === "127.0.0.1");

  if (url.protocol !== "https:" && !isLocalDevelopmentHttp) {
    throw new LlmConfigError("baseUrl must use HTTPS.");
  }

  if (url.username || url.password) {
    throw new LlmConfigError("baseUrl must not contain credentials.");
  }

  if (isPrivateHost(url.hostname)) {
    throw new LlmConfigError("baseUrl must not point to a private address.");
  }

  url.hash = "";
  url.search = "";
  url.pathname = url.pathname.replace(/\/+$/, "");

  return url.toString().replace(/\/$/, "");
}

function encryptApiKey(apiKey: string): Prisma.InputJsonValue {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(apiKey, "utf8"),
    cipher.final(),
  ]);

  return {
    v: KEY_VERSION,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ct: ciphertext.toString("base64"),
  };
}

function decryptApiKey(payload: unknown): string {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new LlmConfigError("Stored LLM API key payload is invalid.");
  }

  const record = payload as Record<string, unknown>;

  if (
    record.v !== KEY_VERSION ||
    typeof record.iv !== "string" ||
    typeof record.tag !== "string" ||
    typeof record.ct !== "string"
  ) {
    throw new LlmConfigError("Stored LLM API key payload is unsupported.");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(record.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(record.tag, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(record.ct, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

function normalizeModel(value: string): string {
  const model = value.trim();

  if (!model || model.length > 160) {
    throw new LlmConfigError("model is required and must be at most 160 chars.");
  }

  return model;
}

function normalizeOptionalNumber(
  value: number | null | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (value === null || value === undefined) {
    return fallback;
  }

  if (!Number.isFinite(value) || value < min || value > max) {
    throw new LlmConfigError(`Value must be between ${min} and ${max}.`);
  }

  return value;
}

export function llmConfigHash(config: {
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
}): string {
  return createHash("sha256")
    .update(
      `${config.baseUrl}|${config.model}|${config.temperature}|${config.maxTokens}`,
    )
    .digest("hex")
    .slice(0, 24);
}

export async function getLlmConfigStatus(
  userId: string,
): Promise<LlmConfigStatus> {
  const row = await prisma.userLlmConfig.findUnique({
    where: { userId },
    select: {
      baseUrl: true,
      model: true,
    },
  });

  if (!row) {
    return {
      configured: false,
      baseUrl: DEFAULT_LLM_BASE_URL,
      model: DEFAULT_LLM_MODEL,
    };
  }

  return {
    configured: true,
    baseUrl: row.baseUrl,
    model: row.model,
  };
}

export async function getUserLlmRuntimeConfig(
  userId: string,
): Promise<LlmRuntimeConfig | null> {
  const row = await prisma.userLlmConfig.findUnique({
    where: { userId },
  });

  if (!row) {
    return null;
  }

  return {
    baseUrl: row.baseUrl,
    apiKey: decryptApiKey(row.apiKeyCiphertext),
    model: row.model,
    temperature: row.temperature ?? DEFAULT_LLM_TEMPERATURE,
    maxTokens: row.maxTokens ?? DEFAULT_LLM_MAX_TOKENS,
    timeoutMs: row.timeoutMs ?? DEFAULT_LLM_TIMEOUT_MS,
  };
}

export async function saveLlmConfig(
  userId: string,
  input: SaveLlmConfigInput,
): Promise<LlmConfigStatus> {
  const baseUrl = normalizeLlmBaseUrl(input.baseUrl);
  const model = normalizeModel(input.model);
  const temperature = normalizeOptionalNumber(
    input.temperature,
    DEFAULT_LLM_TEMPERATURE,
    0,
    2,
  );
  const maxTokens = normalizeOptionalNumber(
    input.maxTokens,
    DEFAULT_LLM_MAX_TOKENS,
    1,
    8192,
  );
  const timeoutMs = normalizeOptionalNumber(
    input.timeoutMs,
    DEFAULT_LLM_TIMEOUT_MS,
    5_000,
    120_000,
  );
  const apiKey = input.apiKey?.trim();
  const existing = await prisma.userLlmConfig.findUnique({
    where: { userId },
    select: { apiKeyCiphertext: true },
  });

  if (!apiKey && !existing) {
    throw new LlmConfigError("API key is required for the first setup.");
  }

  const apiKeyCiphertext = apiKey
    ? encryptApiKey(apiKey)
    : (existing?.apiKeyCiphertext as Prisma.InputJsonValue);

  const row = await prisma.userLlmConfig.upsert({
    where: { userId },
    update: {
      baseUrl,
      apiKeyCiphertext,
      model,
      temperature,
      maxTokens,
      timeoutMs,
    },
    create: {
      userId,
      baseUrl,
      apiKeyCiphertext,
      model,
      temperature,
      maxTokens,
      timeoutMs,
    },
    select: {
      baseUrl: true,
      model: true,
    },
  });

  return {
    configured: true,
    baseUrl: row.baseUrl,
    model: row.model,
  };
}

export async function clearLlmConfig(userId: string): Promise<void> {
  await prisma.userLlmConfig.deleteMany({
    where: { userId },
  });
}

export async function isLlmConfigured(userId: string): Promise<boolean> {
  const count = await prisma.userLlmConfig.count({
    where: { userId },
  });

  return count > 0;
}
