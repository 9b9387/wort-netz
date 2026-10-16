"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/server/auth";
import {
  clearLlmConfig,
  LlmConfigError,
  saveLlmConfig,
} from "@/lib/server/llm-config";

export type LlmSettingsState = {
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

function optionalNumber(value: FormDataEntryValue | null): number | undefined {
  const text = String(value ?? "").trim();

  if (!text) {
    return undefined;
  }

  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export async function saveLlmSettings(
  _previousState: LlmSettingsState,
  formData: FormData,
): Promise<LlmSettingsState> {
  const user = await requireUser();
  const apiKey = String(formData.get("apiKey") ?? "").trim();

  try {
    await saveLlmConfig(user.id, {
      baseUrl: String(formData.get("baseUrl") ?? ""),
      apiKey: apiKey || undefined,
      model: String(formData.get("model") ?? ""),
      temperature: optionalNumber(formData.get("temperature")),
      maxTokens: optionalNumber(formData.get("maxTokens")),
      timeoutMs: optionalNumber(formData.get("timeoutMs")),
    });
  } catch (error) {
    if (error instanceof LlmConfigError) {
      return { message: error.message };
    }

    console.error("saveLlmSettings failed", {
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return { message: "保存失败，请稍后重试。" };
  }

  revalidatePath("/settings/ai");
  return { message: "saved" };
}

export async function clearLlmSettings(): Promise<void> {
  const user = await requireUser();
  await clearLlmConfig(user.id);
  revalidatePath("/settings/ai");
}
