"use client";

import { useActionState } from "react";
import { KeyRoundIcon, SaveIcon, Trash2Icon } from "lucide-react";
import {
  clearLlmSettings,
  saveLlmSettings,
  type LlmSettingsState,
} from "@/app/actions/llm-settings";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

type LlmSettingsFormProps = {
  initial: {
    configured: boolean;
    baseUrl: string;
    model: string;
  };
  encryptionReady: boolean;
  defaults: {
    temperature: number;
    maxTokens: number;
    timeoutMs: number;
  };
  labels: {
    title: string;
    description: string;
    statusConfigured: string;
    statusMissing: string;
    baseUrl: string;
    baseUrlHint: string;
    apiKey: string;
    apiKeyKeep: string;
    model: string;
    advanced: string;
    temperature: string;
    maxTokens: string;
    maxTokensHint: string;
    timeoutMs: string;
    save: string;
    saving: string;
    saved: string;
    encryptionMissing: string;
    clear: string;
    clearHint: string;
  };
};

export function LlmSettingsForm({
  initial,
  encryptionReady,
  defaults,
  labels,
}: LlmSettingsFormProps) {
  const [state, formAction, pending] = useActionState(
    saveLlmSettings,
    {} as LlmSettingsState,
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2 text-sm">
        <KeyRoundIcon />
        <span className="font-medium">
          {initial.configured ? labels.statusConfigured : labels.statusMissing}
        </span>
      </div>

      <form action={formAction} className="flex flex-col gap-5">
        {!encryptionReady && (
          <Alert variant="destructive">
            <AlertDescription>{labels.encryptionMissing}</AlertDescription>
          </Alert>
        )}

        {state.message && state.message !== "saved" && (
          <Alert variant="destructive">
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        )}

        {state.message === "saved" && (
          <Alert>
            <AlertDescription>{labels.saved}</AlertDescription>
          </Alert>
        )}

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="llm-base-url">{labels.baseUrl}</FieldLabel>
            <Input
              id="llm-base-url"
              name="baseUrl"
              type="url"
              defaultValue={initial.baseUrl}
              disabled={pending}
              required
            />
            <FieldDescription>{labels.baseUrlHint}</FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="llm-api-key">{labels.apiKey}</FieldLabel>
            <Input
              id="llm-api-key"
              name="apiKey"
              type="password"
              autoComplete="off"
              disabled={pending}
              placeholder={
                initial.configured ? labels.apiKeyKeep : "sk-..."
              }
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="llm-model">{labels.model}</FieldLabel>
            <Input
              id="llm-model"
              name="model"
              defaultValue={initial.model}
              disabled={pending}
              required
            />
          </Field>
        </FieldGroup>

        <details className="rounded-lg border p-4">
          <summary className="cursor-pointer text-sm font-medium">
            {labels.advanced}
          </summary>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Field>
              <FieldLabel htmlFor="llm-temperature">
                {labels.temperature}
              </FieldLabel>
              <Input
                id="llm-temperature"
                name="temperature"
                type="number"
                min={0}
                max={2}
                step={0.1}
                placeholder={String(defaults.temperature)}
                disabled={pending}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="llm-max-tokens">
                {labels.maxTokens}
              </FieldLabel>
              <Input
                id="llm-max-tokens"
                name="maxTokens"
                type="number"
                min={1}
                max={8192}
                placeholder={String(defaults.maxTokens)}
                disabled={pending}
              />
              <FieldDescription>{labels.maxTokensHint}</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="llm-timeout">
                {labels.timeoutMs}
              </FieldLabel>
              <Input
                id="llm-timeout"
                name="timeoutMs"
                type="number"
                min={5000}
                max={120000}
                step={1000}
                placeholder={String(defaults.timeoutMs)}
                disabled={pending}
              />
            </Field>
          </div>
        </details>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? (
              <>
                <Spinner data-icon="inline-start" />
                {labels.saving}
              </>
            ) : (
              <>
                <SaveIcon data-icon="inline-start" />
                {labels.save}
              </>
            )}
          </Button>
        </div>
      </form>

      {initial.configured && (
        <form action={clearLlmSettings} className="border-t pt-5">
          <Button type="submit" variant="destructive" size="sm">
            <Trash2Icon data-icon="inline-start" />
            {labels.clear}
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            {labels.clearHint}
          </p>
        </form>
      )}
    </div>
  );
}
