import { nowIso } from "@/lib/schemas/seed";
import type { AuditEvent, EntityType, ActionType, ActorType } from "@/lib/schemas/types";

export function buildAuditEvent(input: {
  actorType: ActorType;
  actorId?: string;
  source: "ui" | "agent" | "system";
  entityType: EntityType;
  entityId: string;
  actionType: ActionType;
  correlationId?: string;
  beforeJson?: string;
  afterJson?: string;
  diffJson?: string;
  snapshotId?: string;
}): AuditEvent {
  return {
    id: crypto.randomUUID(),
    timestamp: nowIso(),
    actorType: input.actorType,
    actorId: input.actorId,
    source: input.source,
    entityType: input.entityType,
    entityId: input.entityId,
    actionType: input.actionType,
    beforeJson: input.beforeJson,
    afterJson: input.afterJson,
    diffJson: input.diffJson,
    correlationId: input.correlationId ?? crypto.randomUUID(),
    snapshotId: input.snapshotId,
  };
}
