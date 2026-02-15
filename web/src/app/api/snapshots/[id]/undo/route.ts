import { NextResponse } from "next/server";
import { agentService } from "@/lib/agent/agent-service";
import { requireStudentAuth } from "@/lib/server/auth-guard";
import { upsertStudentFromAuth } from "@/lib/server/houra-repo";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireStudentAuth();
  if (!guard.ok) return guard.response;

  const { id } = await context.params;
  const student = await upsertStudentFromAuth(guard.auth);

  const result = await agentService.undo({
    snapshotId: id,
    actorId: guard.auth.clerkUserId,
    studentId: student.id,
  });

  return NextResponse.json(result);
}
