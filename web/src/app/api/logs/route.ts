import { NextResponse } from "next/server";
import { z } from "zod";
import { buildAuditEvent } from "@/lib/server/audit";
import { requireStudentAuth } from "@/lib/server/auth-guard";
import {
  createServiceEntry,
  recordAuditEvent,
  upsertStudentFromAuth,
} from "@/lib/server/houra-repo";
import { jsonError } from "@/lib/server/http";

const schema = z.object({
  id: z.string().uuid().optional(),
  organizationId: z.string().uuid(),
  activityName: z.string().min(1).max(200),
  description: z.string().max(4000).optional(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime().optional(),
  durationMinutes: z.number().int().positive().max(24 * 60),
  status: z.enum(["Draft", "Pending Review", "Verified", "Rejected", "Exported"]).optional(),
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

  const entry = await createServiceEntry({
    id: parsed.data.id,
    studentId: student.id,
    organizationId: parsed.data.organizationId,
    activityName: parsed.data.activityName,
    description: parsed.data.description,
    startAt: parsed.data.startAt,
    endAt: parsed.data.endAt ?? parsed.data.startAt,
    durationMinutes: parsed.data.durationMinutes,
    status: parsed.data.status ?? "Pending Review",
  });

  await recordAuditEvent(
    buildAuditEvent({
      actorType: "student",
      actorId: guard.auth.clerkUserId,
      source: "ui",
      entityType: "serviceEntry",
      entityId: entry.id,
      actionType: "create",
      afterJson: JSON.stringify(entry),
      correlationId: entry.id,
    }),
  );

  return NextResponse.json({ entry });
}
