import { dangerousActionKinds, requiresApproval } from "@/lib/agent/guardrails";
import { createAgentRun, generateAgentActions } from "@/lib/agent/openai-runtime";
import { nowIso } from "@/lib/schemas/seed";
import type { AuditEvent, StateSnapshot } from "@/lib/schemas/types";
import type { AgentService } from "@/lib/services/interfaces";
import {
  clearDangerousApproval,
  isDangerousApproved,
  listAgentActions,
  markDangerousApproval,
  mutateState,
  pushAudit,
  pushSnapshot,
  readState,
  updateAgentActions,
  writeAgentRun,
} from "@/lib/server/runtime-db";

export const agentService: AgentService = {
  async run(input) {
    const state = readState();
    const run = await createAgentRun(input);
    const actions = await generateAgentActions({ run, state });

    writeAgentRun({ ...run, status: "Awaiting Approval" }, actions);

    pushAudit(agentAudit({
      actorType: "ai_agent",
      entityType: "agentRun",
      entityId: run.id,
      actionType: "create",
      afterJson: JSON.stringify(run),
      correlationId: run.id,
    }));

    actions.forEach((action) => {
      pushAudit(
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

      if (!dangerousActionKinds.includes(action.actionKind)) {
        markDangerousApproval(action.id);
      }
    });

    return { run: { ...run, status: "Awaiting Approval" }, actions };
  },

  async apply(input) {
    const actions = listAgentActions(input.runId).filter((action) =>
      input.actionIds.includes(action.id),
    );

    const dangerous = actions.filter((action) => requiresApproval(action.actionKind));
    if (dangerous.length > 0 && !input.approveDangerous) {
      throw new Error("Dangerous actions require approval");
    }

    dangerous.forEach((action) => markDangerousApproval(action.id));

    const allowed = actions.filter((action) => isDangerousApproved(action.id));

    mutateState((db) => {
      allowed.forEach((action) => {
        if (action.targetEntity === "serviceEntry" && action.actionKind === "status_normalization") {
          db.entries = db.entries.map((entry) =>
            entry.id === action.targetId
              ? { ...entry, status: "Verified", updatedAt: nowIso() }
              : entry,
          );
        }

        if (action.targetEntity === "shareLink" && action.actionKind === "share_link_change") {
          db.shareLinks = db.shareLinks.map((link) =>
            link.id === action.targetId ? { ...link, revokedAt: nowIso() } : link,
          );
        }

        if (action.targetEntity === "syncQueueItem" && action.actionKind === "sync_retry") {
          db.syncQueue = db.syncQueue.map((item) =>
            item.id === action.targetId ? { ...item, status: "Uploading" } : item,
          );
        }
      });
    });

    const snapshot: StateSnapshot = {
      id: crypto.randomUUID(),
      studentId: input.actorId,
      batchId: input.runId,
      snapshotJson: JSON.stringify({ actionIds: allowed.map((action) => action.id), at: nowIso() }),
      createdAt: nowIso(),
    };

    pushSnapshot(snapshot);

    updateAgentActions(
      allowed.map((action) => action.id),
      {
        approved: true,
        appliedAt: nowIso(),
        actionType: "apply",
      },
    );

    allowed.forEach((action) => {
      clearDangerousApproval(action.id);
      pushAudit(
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
    });

    return { snapshotId: snapshot.id, applied: allowed };
  },

  async undo(input) {
    pushAudit(
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
