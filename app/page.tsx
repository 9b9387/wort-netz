import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { getDictionary } from "@/lib/i18n";

export default function Home() {
  const t = getDictionary("zh");

  return (
    <main className="flex min-h-svh flex-1 items-center justify-center bg-background px-6 py-20">
      <div className="w-full max-w-xl text-center">
        <p className="text-sm font-medium uppercase tracking-[0.3em] text-primary">
          {t.appName}
        </p>
        <h1 className="mt-5 font-heading text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          {t.tagline}
        </h1>
        <p className="mt-6 text-lg leading-8 text-muted-foreground">
          以词元为中心，把每一次查词沉淀成可检索的个人德语语料库。
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            className={buttonVariants({ size: "lg" })}
            href="/signup"
          >
            {t.signup}
            <ArrowRightIcon data-icon="inline-end" />
          </Link>
          <Link
            className={buttonVariants({ variant: "outline", size: "lg" })}
            href="/login"
          >
            {t.login}
          </Link>
        </div>
      </div>
    </main>
  );
}
