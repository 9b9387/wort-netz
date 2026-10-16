import { Suspense } from "react";
import { connection } from "next/server";
import { LlmSettingsForm } from "@/components/llm-settings-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireUser } from "@/lib/server/auth";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DEFAULT_LLM_MAX_TOKENS,
  DEFAULT_LLM_TEMPERATURE,
  DEFAULT_LLM_TIMEOUT_MS,
  getLlmConfigStatus,
  hasLlmEncryptionKey,
} from "@/lib/server/llm-config";
import { getDictionary } from "@/lib/i18n";

export default async function AiSettingsPage() {
  return (
    <Suspense fallback={<AiSettingsSkeleton />}>
      <AiSettingsContent />
    </Suspense>
  );
}

async function AiSettingsContent() {
  await connection();
  const t = getDictionary("zh");
  const user = await requireUser();
  const status = await getLlmConfigStatus(user.id);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <section className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          {t.aiSettingsTitle}
        </h1>
        <p className="text-muted-foreground">{t.aiSettingsDescription}</p>
      </section>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>{t.aiSettingsCardTitle}</CardTitle>
          <CardDescription>{t.aiSettingsCardDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <LlmSettingsForm
            initial={status}
            encryptionReady={hasLlmEncryptionKey()}
            defaults={{
              temperature: DEFAULT_LLM_TEMPERATURE,
              maxTokens: DEFAULT_LLM_MAX_TOKENS,
              timeoutMs: DEFAULT_LLM_TIMEOUT_MS,
            }}
            labels={{
              title: t.aiSettingsCardTitle,
              description: t.aiSettingsCardDescription,
              statusConfigured: t.aiStatusConfigured,
              statusMissing: t.aiStatusMissing,
              baseUrl: t.aiBaseUrl,
              baseUrlHint: t.aiBaseUrlHint,
              apiKey: t.aiApiKey,
              apiKeyKeep: t.aiApiKeyKeep,
              model: t.aiModel,
              advanced: t.aiAdvanced,
              temperature: t.aiTemperature,
              maxTokens: t.aiMaxTokens,
              maxTokensHint: t.aiMaxTokensHint,
              timeoutMs: t.aiTimeoutMs,
              save: t.aiSave,
              saving: t.aiSaving,
              saved: t.aiSaved,
              encryptionMissing: t.aiEncryptionMissing,
              clear: t.aiClear,
              clearHint: t.aiClearHint,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function AiSettingsSkeleton() {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <Skeleton className="h-9 w-48" />
      <Skeleton className="mt-3 h-5 w-full max-w-xl" />
      <Skeleton className="mt-6 h-[520px] rounded-xl" />
    </div>
  );
}
