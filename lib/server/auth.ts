import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  email: string | null;
};

/**
 * Resolves the signed-in user once per request. `getClaims()` verifies the JWT
 * locally against the project JWKS instead of calling the Auth server on every
 * call, and `cache()` lets the page, the header and the AI panel share the
 * result. Falls back to a server-side `getUser()` lookup when the local
 * verification fails.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (!error && data?.claims) {
    const id = typeof data.claims.sub === "string" ? data.claims.sub : null;

    if (id) {
      return {
        id,
        email:
          typeof data.claims.email === "string" ? data.claims.email : null,
      };
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email ?? null,
  };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}
