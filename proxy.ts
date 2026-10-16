import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // `getClaims()` verifies the JWT against the cached JWKS, which avoids a
  // round trip to the Auth server on every navigation. It falls back to a
  // server-side lookup when local verification is not possible.
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();
  let userId: string | null =
    typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;

  if (claimsError || !userId) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  }

  const pathname = request.nextUrl.pathname;

  if (userId && (pathname === "/login" || pathname === "/signup")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (
    !userId &&
    (pathname.startsWith("/dashboard") ||
      pathname.startsWith("/words") ||
      pathname.startsWith("/reader"))
  ) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
