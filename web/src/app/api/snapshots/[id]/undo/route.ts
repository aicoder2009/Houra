import { NextResponse } from "next/server";
import { clerkAuthService } from "@/lib/clerk/auth-service";
import { agentService } from "@/lib/agent/agent-service";
import { jsonError } from "@/lib/server/http";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const session = await clerkAuthService.getCurrentUser();
  if (!session) return jsonError("Unauthorized", 401);
  if (!session.isApproved || session.role !== "student") return jsonError("Forbidden", 403);

  const { id } = await context.params;

  const result = await agentService.undo({
    snapshotId: id,
    actorId: session.clerkUserId,
  });

  return NextResponse.json(result);
}
