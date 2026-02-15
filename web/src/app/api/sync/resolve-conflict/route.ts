import { NextResponse } from "next/server";
import { z } from "zod";
import { clerkAuthService } from "@/lib/clerk/auth-service";
import { resolveConflict } from "@/lib/server/runtime-db";
import { jsonError } from "@/lib/server/http";
import { buildAuditEvent } from "@/lib/server/audit";
import { pushAudit } from "@/lib/server/runtime-db";

const schema = z.object({
  conflictId: z.string().min(1),
  resolutionJson: z.string().min(2),
  simulatedQueueProcess: z.boolean().optional(),
});

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsed = schema.safeParse(payload);

  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid payload", 400);
  }

  const session = await clerkAuthService.getCurrentUser();
  if (!session && !parsed.data.simulatedQueueProcess) {
    return jsonError("Unauthorized", 401);
  }

  try {
    const conflict = resolveConflict(parsed.data.conflictId, parsed.data.resolutionJson);

    pushAudit(
      buildAuditEvent({
        actorType: session ? "student" : "system",
        actorId: session?.clerkUserId,
        source: session ? "ui" : "system",
        entityType: "syncConflict",
        entityId: conflict.id,
        actionType: "resolveConflict",
        afterJson: JSON.stringify(conflict),
        correlationId: conflict.id,
      }),
    );

    return NextResponse.json(conflict);
  } catch {
    if (parsed.data.simulatedQueueProcess) {
      return NextResponse.json({ ok: true });
    }
    return jsonError("Conflict not found", 404);
  }
}
