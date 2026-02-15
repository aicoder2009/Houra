import { NextResponse } from "next/server";
import { z } from "zod";
import { agentService } from "@/lib/agent/agent-service";
import { requireStudentAuth } from "@/lib/server/auth-guard";
import { upsertStudentFromAuth } from "@/lib/server/houra-repo";
import { jsonError } from "@/lib/server/http";

const schema = z.object({
  runId: z.string().min(1),
  actionIds: z.array(z.string().min(1)).min(1),
  approveDangerous: z.boolean().default(false),
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

  try {
    const result = await agentService.apply({
      runId: parsed.data.runId,
      actionIds: parsed.data.actionIds,
      approveDangerous: parsed.data.approveDangerous,
      actorId: guard.auth.clerkUserId,
      studentId: student.id,
    });

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to apply actions", 409);
  }
}
