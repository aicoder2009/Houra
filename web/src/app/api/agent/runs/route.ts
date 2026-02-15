import { NextResponse } from "next/server";
import { z } from "zod";
import { agentService } from "@/lib/agent/agent-service";
import { requireStudentAuth } from "@/lib/server/auth-guard";
import { upsertStudentFromAuth } from "@/lib/server/houra-repo";
import { jsonError } from "@/lib/server/http";

const schema = z.object({
  objective: z.string().min(3).max(600),
  contextScope: z.string().min(1).max(120),
  model: z.string().min(2).max(120),
  autonomous: z.boolean().default(false),
});

export async function POST(request: Request) {
  const guard = await requireStudentAuth();
  if (!guard.ok) return guard.response;

  const payload = await request.json().catch(() => null);
  const parsed = schema.safeParse(payload);

  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid payload", 400);
  }

  const student = await upsertStudentFromAuth(guard.auth);

  const result = await agentService.run({
    studentId: student.id,
    objective: parsed.data.objective,
    contextScope: parsed.data.contextScope,
    model: parsed.data.model,
    autonomous: parsed.data.autonomous,
  });

  return NextResponse.json(result);
}
