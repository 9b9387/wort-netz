import { connection } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import { UserMenu } from "@/components/user-menu";
import { getDictionary } from "@/lib/i18n";

export async function UserNav() {
  await connection();
  const user = await getCurrentUser();
  const t = getDictionary("zh");

  if (!user) {
    return null;
  }

  return (
    <UserMenu
      email={user.email ?? "WortNetz"}
      signOutLabel={t.logout}
    />
  );
}
