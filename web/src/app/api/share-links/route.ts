import { NextResponse } from "next/server";
import { z } from "zod";
import { buildAuditEvent } from "@/lib/server/audit";
import { requireStudentAuth } from "@/lib/server/auth-guard";
import {
  recordAuditEvent,
  upsertShareLink,
  upsertStudentFromAuth,
} from "@/lib/server/houra-repo";
import { jsonError } from "@/lib/server/http";

const schema = z.object({
  scopeJson: z.string().min(2),
  expiresAt: z.string().datetime(),
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
  const link = await upsertShareLink({
    studentId: student.id,
    scopeJson: parsed.data.scopeJson,
    expiresAt: parsed.data.expiresAt,
  });

  await recordAuditEvent(
    buildAuditEvent({
      actorType: "student",
      actorId: guard.auth.clerkUserId,
      source: "ui",
      entityType: "shareLink",
      entityId: link.id,
      actionType: "share",
      afterJson: JSON.stringify(link),
      correlationId: link.id,
    }),
  );

  return NextResponse.json({ link });
}
