import Link from "next/link";
import { signup } from "@/app/actions/auth";
import { AuthForm } from "@/components/auth-form";
import { getDictionary } from "@/lib/i18n";

export default function SignupPage() {
  const t = getDictionary("zh");

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-6 py-16">
      <AuthForm
        action={signup}
        title={t.signupTitle}
        description="创建一个 WortNetz 账号，开始建立你的词汇网络。"
        submitLabel={t.authSubmit}
        pendingLabel={t.authPending}
        emailLabel={t.authEmail}
        passwordLabel={t.authPassword}
        errorMessage={t.authError}
        autoComplete="new-password"
        footer={
          <Link className="text-emerald-700 hover:underline" href="/login">
            {t.toLogin}
          </Link>
        }
      />
    </main>
  );
}
