"use client";

import { useActionState } from "react";
import { CircleAlertIcon } from "lucide-react";
import type { AuthFormState } from "@/app/actions/auth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

type AuthAction = (
  state: AuthFormState,
  formData: FormData,
) => Promise<AuthFormState>;

export function AuthForm({
  action,
  title,
  description,
  submitLabel,
  pendingLabel,
  emailLabel,
  passwordLabel,
  errorMessage,
  autoComplete,
  footer,
}: {
  action: AuthAction;
  title: string;
  description: string;
  submitLabel: string;
  pendingLabel: string;
  emailLabel: string;
  passwordLabel: string;
  errorMessage: string;
  autoComplete: "current-password" | "new-password";
  footer: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, {
    message: "",
  });

  const emailInvalid = Boolean(state.fieldErrors?.email?.length);
  const passwordInvalid = Boolean(state.fieldErrors?.password?.length);

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>

      <CardContent>
        <form action={formAction} className="flex flex-col gap-5">
          {(state.message || pending) && (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertTitle>{title}</AlertTitle>
              <AlertDescription>
                {pending ? pendingLabel : state.message}
              </AlertDescription>
            </Alert>
          )}

          <FieldGroup>
            <Field data-invalid={emailInvalid} data-disabled={pending}>
              <FieldLabel htmlFor="email">{emailLabel}</FieldLabel>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                disabled={pending}
                aria-invalid={emailInvalid}
                required
              />
              {emailInvalid && <FieldError>{errorMessage}</FieldError>}
            </Field>

            <Field data-invalid={passwordInvalid} data-disabled={pending}>
              <FieldLabel htmlFor="password">{passwordLabel}</FieldLabel>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete={autoComplete}
                disabled={pending}
                aria-invalid={passwordInvalid}
                minLength={8}
                required
              />
              {passwordInvalid && <FieldError>{errorMessage}</FieldError>}
            </Field>
          </FieldGroup>

          <Button type="submit" disabled={pending}>
            {pending ? (
              <>
                <Spinner data-icon="inline-start" />
                {pendingLabel}
              </>
            ) : (
              submitLabel
            )}
          </Button>
        </form>
      </CardContent>

      <CardFooter className="justify-center">{footer}</CardFooter>
    </Card>
  );
}
