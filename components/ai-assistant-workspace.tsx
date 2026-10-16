import { connection } from "next/server";
import { AiAssistant } from "@/components/ai-assistant";
import { getCurrentUser } from "@/lib/server/auth";
import { isLlmConfigured } from "@/lib/server/llm-config";

export async function AiAssistantWorkspace() {
  await connection();
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const configured = await isLlmConfigured(user.id);

  if (!configured) {
    return null;
  }

  return <AiAssistant />;
}
