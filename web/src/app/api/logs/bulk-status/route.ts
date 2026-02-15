import { NextResponse } from "next/server";
import { z } from "zod";
import { buildAuditEvent } from "@/lib/server/audit";
import { requireStudentAuth } from "@/lib/server/auth-guard";
import {
  bulkUpdateEntryStatus,
  recordAuditEvent,
  upsertStudentFromAuth,
} from "@/lib/server/houra-repo";
import { jsonError } from "@/lib/server/http";

const schema = z.object({
  entryIds: z.array(z.string().uuid()).min(1),
  status: z.enum(["Verified", "Rejected", "Pending Review", "Exported"]),
  rejectReason: z.string().min(2).max(500).optional(),
});

export async function POST(request: Request) {
  const guard = await requireStudentAuth();
  if (!guard.ok) return guard.response;

  const payload = await request.json().catch(() => null);
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid payload", 400);
  }

  if (parsed.data.status === "Rejected" && !parsed.data.rejectReason) {
    return jsonError("Reject reason is required", 400);
  }

  const student = await upsertStudentFromAuth(guard.auth);

  const updatedEntries = await bulkUpdateEntryStatus({
    studentId: student.id,
    entryIds: parsed.data.entryIds,
    status: parsed.data.status,
    rejectReason: parsed.data.rejectReason,
    decidedByStudentId: student.id,
    aiSuggested: false,
  });

  await recordAuditEvent(
    buildAuditEvent({
      actorType: "student",
      actorId: guard.auth.clerkUserId,
      source: "ui",
      entityType: "serviceEntry",
      entityId: parsed.data.entryIds[0],
      actionType: "update",
      diffJson: JSON.stringify({
        status: parsed.data.status,
        count: parsed.data.entryIds.length,
      }),
      correlationId: crypto.randomUUID(),
    }),
  );

  return NextResponse.json({
    updatedEntries,
    count: updatedEntries.length,
  });
}
