import Link from "next/link";
import { Suspense } from "react";
import { CircleCheckIcon } from "lucide-react";
import { login } from "@/app/actions/auth";
import { AuthForm } from "@/components/auth-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { getDictionary } from "@/lib/i18n";

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ confirmation?: string }>;
}) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-background px-6 py-16">
      <Suspense fallback={<Skeleton className="h-[28rem] w-full max-w-md rounded-xl" />}>
        <LoginContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function LoginContent({
  searchParams,
}: {
  searchParams: Promise<{ confirmation?: string }>;
}) {
  const params = await searchParams;
  const t = getDictionary("zh");
  const confirmationSent = params.confirmation === "sent";

  return (
    <div className="flex w-full max-w-md flex-col gap-6">
      {confirmationSent && (
        <Alert>
          <CircleCheckIcon />
          <AlertTitle>确认邮件已发送</AlertTitle>
          <AlertDescription>
            注册链接已发送到你的邮箱，请查收确认。
          </AlertDescription>
        </Alert>
      )}
      <AuthForm
        action={login}
        title={t.loginTitle}
        description="登录后继续追踪你的德语词汇。"
        submitLabel={t.authSubmit}
        pendingLabel={t.authPending}
        emailLabel={t.authEmail}
        passwordLabel={t.authPassword}
        errorMessage={t.authError}
        autoComplete="current-password"
        footer={
          <Link className="text-emerald-700 hover:underline" href="/signup">
            {t.toSignup}
          </Link>
        }
      />
    </div>
  );
}
