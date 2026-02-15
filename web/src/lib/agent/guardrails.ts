import type { AgentActionKind, AgentSafetyClass } from "@/lib/schemas/types";

export const dangerousActionKinds: AgentActionKind[] = [
  "archive_record",
  "share_link_change",
  "export_generation",
  "bulk_status_transition",
];

export function getSafetyClass(actionKind: AgentActionKind): AgentSafetyClass {
  return dangerousActionKinds.includes(actionKind) ? "dangerous" : "safe";
}

export function requiresApproval(actionKind: AgentActionKind): boolean {
  return getSafetyClass(actionKind) === "dangerous";
}
