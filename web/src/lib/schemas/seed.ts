import { addDays } from "date-fns";
import type {
  AgentAction,
  AgentRun,
  AuditEvent,
  Goal,
  HouraState,
  ModelOption,
  Opportunity,
  Organization,
  ReportPreset,
  ServiceEntry,
  ShareLink,
  Student,
  SyncConflict,
  SyncQueueItem,
} from "@/lib/schemas/types";

export const nowIso = () => new Date().toISOString();
export const makeId = () => crypto.randomUUID();
const BASE_SEED_DATE = new Date("2026-02-15T12:00:00.000Z");

function seedIso(daysOffset: number) {
  return addDays(BASE_SEED_DATE, daysOffset).toISOString();
}

export const modelOptions: readonly ModelOption[] = [
  { id: "gpt-5.3", label: "GPT-5.3 Codex", value: "gpt-5.3-codex", isDefault: true },
  { id: "gpt-5.2", label: "GPT-5.2", value: "gpt-5.2" },
  { id: "gpt-4.1", label: "GPT-4.1", value: "gpt-4.1" },
];

export function createSeedState(clerkUserId = "demo-clerk-user"): HouraState {
  const student: Student = {
    id: "student_seed_001",
    clerkUserId,
    name: "Karthick Arun",
    email: "student@example.edu",
    schoolName: "Basha High School",
    gradYear: 2027,
    timezone: "America/Phoenix",
    createdAt: seedIso(-45),
    updatedAt: seedIso(-1),
  };

  const orgNhs: Organization = {
    id: "org_seed_nhs",
    studentId: student.id,
    name: "NHS Club (Basha)",
    evidenceRequired: true,
    archivedAt: null,
  };

  const orgClarendale: Organization = {
    id: "org_seed_clarendale",
    studentId: student.id,
    name: "Clarendale at Chandler",
    evidenceRequired: true,
    archivedAt: null,
  };

  const goals: Goal[] = [
    {
      id: "goal_seed_001",
      studentId: student.id,
      organizationId: orgNhs.id,
      title: "NHS 15 hours by Dec 12",
      targetHours: 15,
      dueDate: seedIso(14),
      status: "Behind",
    },
  ];

  const opportunities: Opportunity[] = [
    {
      id: "opp_seed_001",
      organizationId: orgClarendale.id,
      title: "Care Package Assembly",
      date: seedIso(5),
      status: "Planned",
      notes: "Bring packing tape",
    },
  ];

  const entries: ServiceEntry[] = [
    {
      id: "entry_seed_001",
      studentId: student.id,
      organizationId: orgNhs.id,
      activityName: "Holiday Drive",
      description: "Sorted and packed donations",
      startAt: seedIso(-3),
      endAt: seedIso(-3),
      durationMinutes: 120,
      status: "Pending Review",
      createdAt: seedIso(-3),
      updatedAt: seedIso(-3),
    },
    {
      id: "entry_seed_002",
      studentId: student.id,
      organizationId: orgClarendale.id,
      activityName: "Senior Cards",
      description: "Wrote cards with outreach team",
      startAt: seedIso(-6),
      endAt: seedIso(-6),
      durationMinutes: 90,
      status: "Verified",
      createdAt: seedIso(-6),
      updatedAt: seedIso(-6),
    },
  ];

  const reportPresets: ReportPreset[] = [
    {
      id: "preset_seed_001",
      studentId: student.id,
      name: "NHS Submission",
      filtersJson: '{"organization":"NHS"}',
    },
    {
      id: "preset_seed_002",
      studentId: student.id,
      name: "All Hours",
      filtersJson: "{}",
    },
  ];

  const shareLinks: ShareLink[] = [
    {
      id: "share_seed_001",
      studentId: student.id,
      tokenHash: "seedtoken000000000001",
      scopeJson: '{"scope":"Current School Year"}',
      expiresAt: seedIso(30),
      revokedAt: null,
    },
  ];

  const syncQueue: SyncQueueItem[] = [
    {
      id: "sync_seed_001",
      entityType: "serviceEntry",
      entityId: entries[0].id,
      operation: "update",
      payload: JSON.stringify({ status: "Pending Review" }),
      status: "Queued",
      retryCount: 0,
      createdAt: seedIso(-1),
    },
  ];

  const conflicts: SyncConflict[] = [
    {
      id: "conflict_seed_001",
      entityType: "serviceEntry",
      entityId: entries[0].id,
      localJson: JSON.stringify({ description: "Local updated notes" }),
      remoteJson: JSON.stringify({ description: "Remote updated notes" }),
      status: "open",
    },
  ];

  const run: AgentRun = {
    id: "run_seed_001",
    studentId: student.id,
    model: "gpt-5.3-codex",
    objective: "Keep service records submission-ready without manual cleanup.",
    contextScope: "dashboard",
    status: "Awaiting Approval",
    autonomous: true,
    createdAt: seedIso(-1),
  };

  const actions: AgentAction[] = [
    {
      id: "action_seed_001",
      runId: run.id,
      actionType: "propose",
      actionKind: "status_normalization",
      safetyClass: "safe",
      targetEntity: "serviceEntry",
      targetId: entries[0].id,
      title: "Verify Holiday Drive entry",
      detail: "Evidence attached and duration valid. Set status to Verified.",
      diffJson: '{"status":"Pending Review->Verified"}',
      approved: true,
    },
    {
      id: "action_seed_002",
      runId: run.id,
      actionType: "propose",
      actionKind: "share_link_change",
      safetyClass: "dangerous",
      targetEntity: "shareLink",
      targetId: shareLinks[0].id,
      title: "Revoke expired share link",
      detail: "Link expired and should be revoked for safety.",
      diffJson: '{"revokedAt":"set"}',
      approved: false,
    },
  ];

  const auditEvents: AuditEvent[] = [
    {
      id: "audit_seed_001",
      timestamp: seedIso(-1),
      actorType: "ai_agent",
      source: "agent",
      entityType: "agentRun",
      entityId: run.id,
      actionType: "create",
      afterJson: JSON.stringify(run),
      correlationId: run.id,
    },
  ];

  return {
    student,
    organizations: [orgNhs, orgClarendale],
    goals,
    opportunities,
    entries,
    evidenceAssets: [],
    verificationDecisions: [],
    reportPresets,
    shareLinks,
    importJobs: [],
    syncQueue,
    conflicts,
    agentRuns: [run],
    agentActions: actions,
    snapshots: [],
    auditEvents,
  };
}
