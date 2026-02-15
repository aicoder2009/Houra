import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStudentAuth } from "@/lib/server/auth-guard";
import { jsonError } from "@/lib/server/http";
import { buildAuditEvent } from "@/lib/server/audit";
import {
  recordAuditEvent,
  resolveSyncConflict,
  upsertStudentFromAuth,
} from "@/lib/server/houra-repo";

const schema = z.object({
  conflictId: z.string().min(1),
  resolutionJson: z.string().min(2),
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
    const conflict = await resolveSyncConflict({
      studentId: student.id,
      conflictId: parsed.data.conflictId,
      resolutionJson: parsed.data.resolutionJson,
    });

    await recordAuditEvent(
      buildAuditEvent({
        actorType: "student",
        actorId: guard.auth.clerkUserId,
        source: "ui",
        entityType: "syncConflict",
        entityId: conflict.id,
        actionType: "resolveConflict",
        afterJson: JSON.stringify(conflict),
        correlationId: conflict.id,
      }),
    );

    return NextResponse.json(conflict);
  } catch {
    return jsonError("Conflict not found", 404);
  }
}
