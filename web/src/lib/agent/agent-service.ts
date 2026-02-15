import { dangerousActionKinds, requiresApproval } from "@/lib/agent/guardrails";
import { createAgentRun, generateAgentActions } from "@/lib/agent/openai-runtime";
import { nowIso } from "@/lib/schemas/seed";
import type { AuditEvent, StateSnapshot } from "@/lib/schemas/types";
import type { AgentService } from "@/lib/services/interfaces";
import {
  applyAgentActionEffects,
  getStateForStudent,
  listAgentActionsByRun,
  markAgentActionsApplied,
  recordAuditEvent,
  updateAgentRunStatus,
  writeAgentRunAndActions,
  writeSnapshot,
} from "@/lib/server/houra-repo";

export const agentService: AgentService = {
  async run(input) {
    const run = await createAgentRun(input);
    const state = await getStateForStudent(input.studentId);
    const actions = await generateAgentActions({ run, state });
    const pendingRun = {
      ...run,
      status: "Awaiting Approval" as const,
    };

    await writeAgentRunAndActions({
      run: pendingRun,
      actions,
    });

    await recordAuditEvent(
      agentAudit({
      actorType: "ai_agent",
      entityType: "agentRun",
      entityId: run.id,
      actionType: "create",
      afterJson: JSON.stringify(run),
      correlationId: run.id,
      }),
    );

    for (const action of actions) {
      await recordAuditEvent(
        agentAudit({
          actorType: "ai_agent",
          entityType: "agentAction",
          entityId: action.id,
          actionType: "propose",
          afterJson: JSON.stringify(action),
          diffJson: action.diffJson,
          correlationId: run.id,
        }),
      );
    }

    return { run: pendingRun, actions };
  },

  async apply(input) {
    const actions = (await listAgentActionsByRun(input.runId)).filter((action) =>
      input.actionIds.includes(action.id),
    );

    const dangerous = actions.filter((action) => requiresApproval(action.actionKind));
    if (dangerous.length > 0 && !input.approveDangerous) {
      throw new Error("Dangerous actions require approval");
    }

    const allowed = actions.filter(
      (action) => !dangerousActionKinds.includes(action.actionKind) || input.approveDangerous,
    );
    const appliedAt = nowIso();

    for (const action of allowed) {
      await applyAgentActionEffects({
        action,
        now: appliedAt,
        studentId: input.studentId,
      });
    }

    const snapshot: StateSnapshot = {
      id: crypto.randomUUID(),
      studentId: input.studentId,
      batchId: input.runId,
      snapshotJson: JSON.stringify({ actionIds: allowed.map((action) => action.id), at: appliedAt }),
      createdAt: appliedAt,
    };

    await writeSnapshot(snapshot);

    await markAgentActionsApplied({
      actionIds: allowed.map((action) => action.id),
      appliedAt,
    });

    await updateAgentRunStatus({
      runId: input.runId,
      status: "Applied",
    });

    for (const action of allowed) {
      await recordAuditEvent(
        agentAudit({
          actorType: "student",
          actorId: input.actorId,
          entityType: "agentAction",
          entityId: action.id,
          actionType: "apply",
          afterJson: JSON.stringify({ applied: true }),
          diffJson: action.diffJson,
          correlationId: input.runId,
          snapshotId: snapshot.id,
        }),
      );
    }

    return { snapshotId: snapshot.id, applied: allowed };
  },

  async undo(input) {
    await recordAuditEvent(
      agentAudit({
        actorType: "student",
        actorId: input.actorId,
        entityType: "stateSnapshot",
        entityId: input.snapshotId,
        actionType: "undo",
        afterJson: JSON.stringify({ undoneAt: nowIso() }),
        correlationId: crypto.randomUUID(),
        snapshotId: input.snapshotId,
      }),
    );

    return { success: true };
  },
};

function agentAudit(input: Partial<AuditEvent> & {
  actorType: "student" | "ai_agent" | "system";
  entityType: AuditEvent["entityType"];
  entityId: string;
  actionType: AuditEvent["actionType"];
  correlationId: string;
}): AuditEvent {
  return {
    id: crypto.randomUUID(),
    timestamp: nowIso(),
    source: input.actorType === "ai_agent" ? "agent" : "ui",
    actorType: input.actorType,
    actorId: input.actorId,
    entityType: input.entityType,
    entityId: input.entityId,
    actionType: input.actionType,
    beforeJson: input.beforeJson,
    afterJson: input.afterJson,
    diffJson: input.diffJson,
    correlationId: input.correlationId,
    snapshotId: input.snapshotId,
  };
}
