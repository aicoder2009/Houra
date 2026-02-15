import { NextResponse } from "next/server";
import { z } from "zod";
import { agentService } from "@/lib/agent/agent-service";
import { clerkAuthService } from "@/lib/clerk/auth-service";
import { readState } from "@/lib/server/runtime-db";
import { jsonError } from "@/lib/server/http";

const schema = z.object({
  objective: z.string().min(3).max(600),
  contextScope: z.string().min(1).max(120),
  model: z.string().min(2).max(120),
  autonomous: z.boolean().default(false),
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

  const state = readState();
  if (!state.student) {
    return jsonError("Student profile unavailable", 409);
  }

  const result = await agentService.run({
    studentId: state.student.id,
    objective: parsed.data.objective,
    contextScope: parsed.data.contextScope,
    model: parsed.data.model,
    autonomous: parsed.data.autonomous,
  });

  return NextResponse.json(result);
}
