import { NextResponse } from "next/server";
import { z } from "zod";
import { agentService } from "@/lib/agent/agent-service";
import { readState } from "@/lib/server/runtime-db";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { jsonError } from "@/lib/server/http";

const schema = z.object({
  objective: z.string().min(3).max(600).optional(),
  model: z.string().min(2).max(120).optional(),
  contextScope: z.string().min(1).max(120).optional(),
});

export async function POST(request: Request) {
  const cronSecret = process.env.AGENT_CRON_SECRET;
  const header =
    request.headers.get("x-houra-cron-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!cronSecret || !header || header !== cronSecret) {
    return jsonError("Unauthorized cron invocation", 401);
  }

  const payload = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(payload);

  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid payload", 400);
  }

  let studentId = readState().student?.id;
  const supabase = getSupabaseServerClient();

  if (supabase) {
    const { data, error } = await supabase
      .from("students")
      .select("id")
      .eq("role", "student")
      .eq("is_approved", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return jsonError(error.message, 500);
    }
    studentId = data?.id ?? studentId;
  }

  if (!studentId) return jsonError("Student profile unavailable", 409);

  const runResult = await agentService.run({
    studentId,
    objective:
      parsed.data.objective ??
      "Keep logs submission-ready, reduce sync debt, and enforce link hygiene autonomously.",
    contextScope: parsed.data.contextScope ?? "scheduled",
    model: parsed.data.model ?? "gpt-5.3-codex",
    autonomous: true,
  });

  const safeActionIds = runResult.actions
    .filter((action) => action.safetyClass === "safe")
    .map((action) => action.id);

  let applied = 0;
  if (safeActionIds.length > 0) {
    const applyResult = await agentService.apply({
      runId: runResult.run.id,
      actionIds: safeActionIds,
      approveDangerous: false,
      actorId: "system-cron",
      studentId,
    });
    applied = applyResult.applied.length;
  }

  return NextResponse.json({
    runId: runResult.run.id,
    proposed: runResult.actions.length,
    appliedSafe: applied,
  });
}
