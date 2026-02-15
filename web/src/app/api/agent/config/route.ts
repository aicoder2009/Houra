import { NextResponse } from "next/server";
import { requireStudentAuth } from "@/lib/server/auth-guard";

export async function GET() {
  const guard = await requireStudentAuth();
  if (!guard.ok) return guard.response;

  return NextResponse.json({
    openAiConfigured: Boolean(process.env.OPENAI_API_KEY),
    assistantConfigured: Boolean(process.env.OPENAI_ASSISTANT_ID),
  });
}

