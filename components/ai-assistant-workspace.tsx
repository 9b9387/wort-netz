import { connection } from "next/server";
import { AiAssistant } from "@/components/ai-assistant";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/auth";
import { isLlmConfigured } from "@/lib/server/llm-config";

export async function AiAssistantWorkspace() {
  await connection();
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const [configured, profile] = await Promise.all([
    isLlmConfigured(user.id),
    prisma.profile.findUnique({
      where: { id: user.id },
      select: { aiPanelOpen: true },
    }),
  ]);

  if (!configured) {
    return null;
  }

  return <AiAssistant defaultOpen={profile?.aiPanelOpen ?? true} />;
}
