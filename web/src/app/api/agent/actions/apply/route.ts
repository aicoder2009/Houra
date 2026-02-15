import { NextResponse } from "next/server";
import { z } from "zod";
import { clerkAuthService } from "@/lib/clerk/auth-service";
import { agentService } from "@/lib/agent/agent-service";
import { jsonError } from "@/lib/server/http";

const schema = z.object({
  runId: z.string().min(1),
  actionIds: z.array(z.string().min(1)).min(1),
  approveDangerous: z.boolean().default(false),
});

export async function POST(request: Request) {
  const session = await clerkAuthService.getCurrentUser();
  if (!session) return jsonError("Unauthorized", 401);
  if (!session.isApproved || session.role !== "student") return jsonError("Forbidden", 403);

  const payload = await request.json().catch(() => null);
  const parsed = schema.safeParse(payload);

  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid payload", 400);
  }

  try {
    const result = await agentService.apply({
      runId: parsed.data.runId,
      actionIds: parsed.data.actionIds,
      approveDangerous: parsed.data.approveDangerous,
      actorId: session.clerkUserId,
    });

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to apply actions", 409);
  }
}
