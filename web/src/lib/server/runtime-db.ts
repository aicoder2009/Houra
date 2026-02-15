import { createSeedState } from "@/lib/schemas/seed";
import type {
  AgentAction,
  AgentRun,
  AuditEvent,
  HouraState,
  StateSnapshot,
  SyncConflict,
} from "@/lib/schemas/types";

type RuntimeDb = HouraState & {
  dangerousApprovalQueue: Set<string>;
};

declare global {
  var __houraRuntimeDb: RuntimeDb | undefined;
}

function initDb(): RuntimeDb {
  return {
    ...createSeedState(),
    dangerousApprovalQueue: new Set<string>(),
  };
}

function getDb(): RuntimeDb {
  if (!globalThis.__houraRuntimeDb) {
    globalThis.__houraRuntimeDb = initDb();
  }
  return globalThis.__houraRuntimeDb;
}

export function readState(): HouraState {
  const db = getDb();
  return {
    student: db.student,
    organizations: [...db.organizations],
    goals: [...db.goals],
    opportunities: [...db.opportunities],
    entries: [...db.entries],
    evidenceAssets: [...db.evidenceAssets],
    verificationDecisions: [...db.verificationDecisions],
    reportPresets: [...db.reportPresets],
    shareLinks: [...db.shareLinks],
    importJobs: [...db.importJobs],
    syncQueue: [...db.syncQueue],
    conflicts: [...db.conflicts],
    agentRuns: [...db.agentRuns],
    agentActions: [...db.agentActions],
    snapshots: [...db.snapshots],
    auditEvents: [...db.auditEvents],
  };
}

export function writeAgentRun(run: AgentRun, actions: AgentAction[]) {
  const db = getDb();
  db.agentRuns.unshift(run);
  db.agentActions.unshift(...actions);
}

export function listAgentActions(runId: string) {
  const db = getDb();
  return db.agentActions.filter((action) => action.runId === runId);
}

export function updateAgentActions(actionIds: string[], patch: Partial<AgentAction>) {
  const db = getDb();
  db.agentActions = db.agentActions.map((action) =>
    actionIds.includes(action.id) ? { ...action, ...patch } : action,
  );
}

export function pushSnapshot(snapshot: StateSnapshot) {
  const db = getDb();
  db.snapshots.unshift(snapshot);
}

export function getSnapshot(snapshotId: string) {
  const db = getDb();
  return db.snapshots.find((item) => item.id === snapshotId);
}

export function pushAudit(event: AuditEvent) {
  const db = getDb();
  db.auditEvents.unshift(event);
}

export function filterAudit(filters?: {
  actorType?: string;
  entityType?: string;
  actionType?: string;
}) {
  const db = getDb();
  return db.auditEvents.filter((event) => {
    if (filters?.actorType && event.actorType !== filters.actorType) return false;
    if (filters?.entityType && event.entityType !== filters.entityType) return false;
    if (filters?.actionType && event.actionType !== filters.actionType) return false;
    return true;
  });
}

export function markDangerousApproval(actionId: string) {
  const db = getDb();
  db.dangerousApprovalQueue.add(actionId);
}

export function isDangerousApproved(actionId: string) {
  const db = getDb();
  return db.dangerousApprovalQueue.has(actionId);
}

export function clearDangerousApproval(actionId: string) {
  const db = getDb();
  db.dangerousApprovalQueue.delete(actionId);
}

export function resolveConflict(conflictId: string, resolutionJson: string): SyncConflict {
  const db = getDb();
  const index = db.conflicts.findIndex((conflict) => conflict.id === conflictId);
  if (index === -1) {
    throw new Error("Conflict not found");
  }
  const next = {
    ...db.conflicts[index],
    status: "resolved" as const,
    resolutionJson,
  };
  db.conflicts[index] = next;
  return next;
}

export function mutateState(mutator: (db: RuntimeDb) => void) {
  const db = getDb();
  mutator(db);
}
