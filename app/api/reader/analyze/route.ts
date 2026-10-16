import { z } from "zod";
import { analyzeReaderText } from "@/lib/reader/analyze";
import { READER_MAX_CHARS } from "@/lib/reader/types";
import { getCurrentUser } from "@/lib/server/auth";

const analyzeSchema = z.object({
  text: z.string().min(1).max(READER_MAX_CHARS),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let json: unknown;

  try {
    json = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = analyzeSchema.safeParse(json);

  if (!parsed.success) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  try {
    const analysis = await analyzeReaderText({
      userId: user.id,
      text: parsed.data.text,
    });

    return Response.json(analysis);
  } catch (error) {
    console.error("reader analyze failed", {
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    });

    return Response.json({ error: "server_error" }, { status: 500 });
  }
}
