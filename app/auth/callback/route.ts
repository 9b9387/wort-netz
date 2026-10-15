import { NextResponse, type NextRequest } from "next/server";
import { createRequestClient } from "@/lib/supabase/request";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const requestedNext = url.searchParams.get("next") ?? "/dashboard";
  const next = requestedNext.startsWith("/") ? requestedNext : "/dashboard";
  const redirectUrl = new URL(next, url.origin);

  if (code) {
    const response = NextResponse.redirect(redirectUrl);
    const supabase = createRequestClient(request, response);
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return response;
    }
  }

  const response = NextResponse.redirect(
    new URL("/login?message=unable", url.origin),
  );
  const supabase = createRequestClient(request, response);
  await supabase.auth.signOut();

  return response;
}
