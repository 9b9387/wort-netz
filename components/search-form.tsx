"use client";

import { useActionState } from "react";
import { SearchIcon } from "lucide-react";
import { captureWord, type CaptureWordState } from "@/app/actions/words";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

export function SearchForm({
  placeholder,
  submitLabel,
  pendingLabel,
}: {
  placeholder: string;
  submitLabel: string;
  pendingLabel: string;
}) {
  const [state, formAction, pending] = useActionState(
    captureWord,
    {} as CaptureWordState,
  );

  return (
    <form action={formAction} className="w-full">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="query" className="sr-only">
            {placeholder}
          </FieldLabel>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input
              id="query"
              name="query"
              type="search"
              placeholder={placeholder}
              maxLength={80}
              disabled={pending}
              required
              aria-invalid={Boolean(state.message)}
              className="h-11 min-w-0 flex-1"
            />
            <Button
              type="submit"
              size="lg"
              disabled={pending}
              className="w-full sm:w-auto"
            >
              {pending ? (
                <>
                  <Spinner data-icon="inline-start" />
                  {pendingLabel}
                </>
              ) : (
                <>
                  <SearchIcon data-icon="inline-start" />
                  {submitLabel}
                </>
              )}
            </Button>
          </div>
          {state.message && <FieldError>{state.message}</FieldError>}
        </Field>
      </FieldGroup>
    </form>
  );
}
