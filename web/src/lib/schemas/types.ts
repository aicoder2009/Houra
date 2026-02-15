export type UUID = string;

export type EntityType =
  | "student"
  | "organization"
  | "organizationContact"
  | "goal"
  | "opportunity"
  | "serviceEntry"
  | "evidenceAsset"
  | "verificationDecision"
  | "reportPreset"
  | "exportJob"
  | "shareLink"
  | "syncQueueItem"
  | "syncConflict"
  | "importJob"
  | "agentRun"
  | "agentAction"
  | "stateSnapshot"
  | "auditEvent";

export type ActionType =
  | "create"
  | "update"
  | "archive"
  | "export"
  | "share"
  | "propose"
  | "apply"
  | "undo"
  | "resolveConflict";

export type ActorType = "student" | "ai_agent" | "system";

export type ServiceEntryStatus =
  | "Draft"
  | "Pending Review"
  | "Verified"
  | "Rejected"
  | "Exported";

export type SyncState = "Queued" | "Uploading" | "Failed" | "Synced" | "Partially Synced";

export type GoalStatus = "On Track" | "Behind" | "Completed" | "Archived";

export type OpportunityStatus = "Planned" | "Confirmed" | "Completed" | "Cancelled";

export type AgentRunStatus = "Queued" | "Proposing" | "Awaiting Approval" | "Applied" | "Failed";

export type AgentSafetyClass = "safe" | "dangerous";

export type AgentActionKind =
  | "status_normalization"
  | "dedup_metadata"
  | "sync_retry"
  | "archive_record"
  | "share_link_change"
  | "export_generation"
  | "bulk_status_transition";

export type ModelOption = {
  id: string;
  label: string;
  value: string;
  isDefault?: boolean;
};

export type Student = {
  id: UUID;
  clerkUserId: string;
  name: string;
  email: string;
  schoolName?: string;
  gradYear?: number;
  timezone: string;
  createdAt: string;
  updatedAt: string;
};

export type Organization = {
  id: UUID;
  studentId: UUID;
  name: string;
  email?: string;
  phone?: string;
  evidenceRequired: boolean;
  archivedAt?: string | null;
};

export type OrganizationContact = {
  id: UUID;
  organizationId: UUID;
  role: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
};

export type Goal = {
  id: UUID;
  studentId: UUID;
  organizationId?: UUID;
  title: string;
  targetHours: number;
  dueDate: string;
  status: GoalStatus;
};

export type Opportunity = {
  id: UUID;
  organizationId: UUID;
  title: string;
  date: string;
  status: OpportunityStatus;
  notes?: string;
};

export type ServiceEntry = {
  id: UUID;
  studentId: UUID;
  organizationId: UUID;
  activityName: string;
  description?: string;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  status: ServiceEntryStatus;
  rejectReason?: string;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EvidenceAsset = {
  id: UUID;
  entryId: UUID;
  storageKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  syncState: SyncState;
};

export type VerificationDecision = {
  id: UUID;
  entryId: UUID;
  decision: "Verified" | "Rejected";
  reason: string;
  decidedByStudentId: UUID;
  decidedAt: string;
  aiSuggested: boolean;
};

export type ReportPreset = {
  id: UUID;
  studentId: UUID;
  name: string;
  filtersJson: string;
};

export type ExportJob = {
  id: UUID;
  studentId: UUID;
  format: "pdf" | "csv";
  rangeStart: string;
  rangeEnd: string;
  fileUrl?: string;
  createdAt: string;
};

export type ShareLink = {
  id: UUID;
  studentId: UUID;
  tokenHash: string;
  scopeJson: string;
  expiresAt: string;
  revokedAt?: string | null;
};

export type SyncQueueItem = {
  id: UUID;
  entityType: EntityType;
  entityId: UUID;
  operation: ActionType;
  payload: string;
  status: SyncState;
  retryCount: number;
  createdAt: string;
};

export type SyncConflict = {
  id: UUID;
  entityType: EntityType;
  entityId: UUID;
  localJson: string;
  remoteJson: string;
  resolutionJson?: string;
  status: "open" | "resolved";
};

export type ImportJob = {
  id: UUID;
  studentId: UUID;
  sourceType: "csv" | "xlsx";
  status: "queued" | "processing" | "completed" | "failed";
  confidenceJson: string;
  createdAt: string;
};

export type AgentRun = {
  id: UUID;
  studentId: UUID;
  model: string;
  objective: string;
  contextScope: string;
  status: AgentRunStatus;
  autonomous: boolean;
  createdAt: string;
};

export type AgentAction = {
  id: UUID;
  runId: UUID;
  actionType: ActionType;
  actionKind: AgentActionKind;
  safetyClass: AgentSafetyClass;
  targetEntity: EntityType;
  targetId: UUID;
  title: string;
  detail: string;
  diffJson: string;
  approved: boolean;
  appliedAt?: string;
};

export type StateSnapshot = {
  id: UUID;
  studentId: UUID;
  batchId: UUID;
  snapshotJson: string;
  createdAt: string;
};

export type AuditEvent = {
  id: UUID;
  timestamp: string;
  actorType: ActorType;
  actorId?: UUID;
  source: "ui" | "agent" | "system";
  entityType: EntityType;
  entityId: UUID;
  actionType: ActionType;
  beforeJson?: string;
  afterJson?: string;
  diffJson?: string;
  correlationId: UUID;
  snapshotId?: UUID;
};

export type HouraState = {
  student: Student | null;
  organizations: Organization[];
  goals: Goal[];
  opportunities: Opportunity[];
  entries: ServiceEntry[];
  evidenceAssets: EvidenceAsset[];
  verificationDecisions: VerificationDecision[];
  reportPresets: ReportPreset[];
  shareLinks: ShareLink[];
  importJobs: ImportJob[];
  syncQueue: SyncQueueItem[];
  conflicts: SyncConflict[];
  agentRuns: AgentRun[];
  agentActions: AgentAction[];
  snapshots: StateSnapshot[];
  auditEvents: AuditEvent[];
};

export type AuthContext = {
  clerkUserId: string;
  sessionId: string | null;
  role: "student" | "unknown";
  isApproved: boolean;
  email: string | null;
  name: string | null;
};

export type BootstrapPayload = {
  auth: AuthContext;
  state: HouraState;
};

export type MutationEnvelope = {
  id: UUID;
  entityType: EntityType;
  entityId: UUID;
  operation: ActionType;
  payload: string;
  createdAt: string;
  retryCount: number;
  status: SyncState;
};

export type ConflictResolutionPayload = {
  conflictId: UUID;
  resolutionJson: string;
};
