import { NextResponse } from "next/server";
import { buildAuditEvent } from "@/lib/server/audit";
import { requireStudentAuth } from "@/lib/server/auth-guard";
import {
  recordAuditEvent,
  revokeShareLink,
  upsertStudentFromAuth,
} from "@/lib/server/houra-repo";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireStudentAuth();
  if (!guard.ok) return guard.response;

  const { id } = await context.params;
  const student = await upsertStudentFromAuth(guard.auth);

  await revokeShareLink({ studentId: student.id, linkId: id });

  await recordAuditEvent(
    buildAuditEvent({
      actorType: "student",
      actorId: guard.auth.clerkUserId,
      source: "ui",
      entityType: "shareLink",
      entityId: id,
      actionType: "update",
      diffJson: JSON.stringify({ revokedAt: nowIso() }),
      correlationId: id,
    }),
  );

  return NextResponse.json({ ok: true });
}

function nowIso() {
  return new Date().toISOString();
}
