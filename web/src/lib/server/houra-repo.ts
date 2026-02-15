import { createSeedState, nowIso } from "@/lib/schemas/seed";
import type {
  ActionType,
  AgentAction,
  AgentRun,
  AuditEvent,
  HouraState,
  ImportJob,
  Organization,
  ServiceEntry,
  ShareLink,
  StateSnapshot,
  Student,
  SyncConflict,
  AuthContext,
} from "@/lib/schemas/types";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  filterAudit,
  mutateState,
  pushAudit,
  pushSnapshot,
  readState,
  resolveConflict as resolveRuntimeConflict,
  updateAgentActions,
  writeAgentRun,
} from "@/lib/server/runtime-db";

const ISO_NOW = () => nowIso();

type StudentRow = {
  id: string;
  clerk_user_id: string;
  name: string;
  email: string;
  school_name: string | null;
  grad_year: number | null;
  timezone: string;
  created_at: string;
  updated_at: string;
};

export type BootstrapPayload = {
  auth: AuthContext;
  state: HouraState;
};

function toJsonString(value: unknown, fallback = "{}") {
  if (typeof value === "string") {
    return value;
  }
  if (value === null || value === undefined) {
    return fallback;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
}

function toJsonValue(raw: string | undefined) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return { value: raw };
  }
}

function mapStudent(row: StudentRow): Student {
  return {
    id: row.id,
    clerkUserId: row.clerk_user_id,
    name: row.name,
    email: row.email,
    schoolName: row.school_name ?? undefined,
    gradYear: row.grad_year ?? undefined,
    timezone: row.timezone,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function fetchStateFromSupabase(studentId: string): Promise<HouraState> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return readState();
  }

  const [
    organizationsRes,
    goalsRes,
    reportPresetsRes,
    shareLinksRes,
    importJobsRes,
    syncQueueRes,
    conflictsRes,
    runsRes,
    snapshotsRes,
    auditsRes,
    entriesRes,
  ] = await Promise.all([
    supabase
      .from("organizations")
      .select("*")
      .eq("student_id", studentId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("goals")
      .select("*")
      .eq("student_id", studentId)
      .is("deleted_at", null)
      .order("due_date", { ascending: true }),
    supabase
      .from("report_presets")
      .select("*")
      .eq("student_id", studentId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("share_links")
      .select("*")
      .eq("student_id", studentId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("import_jobs")
      .select("*")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("sync_queue_items")
      .select("*")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("sync_conflicts")
      .select("*")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("agent_runs")
      .select("*")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("state_snapshots")
      .select("*")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("audit_events")
      .select("*")
      .order("timestamp", { ascending: false })
      .limit(500),
    supabase
      .from("service_entries")
      .select("*")
      .eq("student_id", studentId)
      .is("deleted_at", null)
      .order("start_at", { ascending: false }),
  ]);

  if (organizationsRes.error) throw organizationsRes.error;
  if (goalsRes.error) throw goalsRes.error;
  if (reportPresetsRes.error) throw reportPresetsRes.error;
  if (shareLinksRes.error) throw shareLinksRes.error;
  if (importJobsRes.error) throw importJobsRes.error;
  if (syncQueueRes.error) throw syncQueueRes.error;
  if (conflictsRes.error) throw conflictsRes.error;
  if (runsRes.error) throw runsRes.error;
  if (snapshotsRes.error) throw snapshotsRes.error;
  if (auditsRes.error) throw auditsRes.error;
  if (entriesRes.error) throw entriesRes.error;

  const organizations = (organizationsRes.data ?? []).map((row) => ({
    id: row.id,
    studentId: row.student_id,
    name: row.name,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    evidenceRequired: Boolean(row.evidence_required),
    archivedAt: row.archived_at,
  }));

  const orgIds = organizations.map((item) => item.id);
  const entryIds = (entriesRes.data ?? []).map((entry) => entry.id);
  const runIds = (runsRes.data ?? []).map((run) => run.id);

  const [opportunitiesRes, evidenceRes, decisionsRes, actionsRes] = await Promise.all([
    orgIds.length > 0
      ? supabase
          .from("opportunities")
          .select("*")
          .in("organization_id", orgIds)
          .is("deleted_at", null)
          .order("date", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    entryIds.length > 0
      ? supabase
          .from("evidence_assets")
          .select("*")
          .in("entry_id", entryIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    entryIds.length > 0
      ? supabase
          .from("verification_decisions")
          .select("*")
          .in("entry_id", entryIds)
          .order("decided_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    runIds.length > 0
      ? supabase
          .from("agent_actions")
          .select("*")
          .in("run_id", runIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (opportunitiesRes.error) throw opportunitiesRes.error;
  if (evidenceRes.error) throw evidenceRes.error;
  if (decisionsRes.error) throw decisionsRes.error;
  if (actionsRes.error) throw actionsRes.error;

  return {
    student: null,
    organizations,
    goals: (goalsRes.data ?? []).map((row) => ({
      id: row.id,
      studentId: row.student_id,
      organizationId: row.organization_id ?? undefined,
      title: row.title,
      targetHours: Number(row.target_hours),
      dueDate: row.due_date,
      status: row.status,
    })),
    opportunities: (opportunitiesRes.data ?? []).map((row) => ({
      id: row.id,
      organizationId: row.organization_id,
      title: row.title,
      date: row.date,
      status: row.status,
      notes: row.notes ?? undefined,
    })),
    entries: (entriesRes.data ?? []).map((row) => ({
      id: row.id,
      studentId: row.student_id,
      organizationId: row.organization_id,
      activityName: row.activity_name,
      description: row.description ?? undefined,
      startAt: row.start_at,
      endAt: row.end_at,
      durationMinutes: row.duration_minutes,
      status: row.status,
      rejectReason: row.reject_reason ?? undefined,
      archivedAt: row.archived_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
    evidenceAssets: (evidenceRes.data ?? []).map((row) => ({
      id: row.id,
      entryId: row.entry_id,
      storageKey: row.storage_key,
      fileName: row.file_name,
      mimeType: row.mime_type,
      sizeBytes: row.size_bytes,
      syncState: row.sync_state,
    })),
    verificationDecisions: (decisionsRes.data ?? []).map((row) => ({
      id: row.id,
      entryId: row.entry_id,
      decision: row.decision,
      reason: row.reason,
      decidedByStudentId: row.decided_by_student_id,
      decidedAt: row.decided_at,
      aiSuggested: Boolean(row.ai_suggested),
    })),
    reportPresets: (reportPresetsRes.data ?? []).map((row) => ({
      id: row.id,
      studentId: row.student_id,
      name: row.name,
      filtersJson: toJsonString(row.filters_json),
    })),
    shareLinks: (shareLinksRes.data ?? []).map((row) => ({
      id: row.id,
      studentId: row.student_id,
      tokenHash: row.token_hash,
      scopeJson: toJsonString(row.scope_json),
      expiresAt: row.expires_at,
      revokedAt: row.revoked_at,
    })),
    importJobs: (importJobsRes.data ?? []).map((row) => ({
      id: row.id,
      studentId: row.student_id,
      sourceType: row.source_type,
      status: row.status,
      confidenceJson: toJsonString(row.confidence_json),
      createdAt: row.created_at,
    })),
    syncQueue: (syncQueueRes.data ?? []).map((row) => ({
      id: row.id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      operation: row.operation,
      payload: toJsonString(row.payload_json),
      status: row.status,
      retryCount: row.retry_count,
      createdAt: row.created_at,
    })),
    conflicts: (conflictsRes.data ?? []).map((row) => ({
      id: row.id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      localJson: toJsonString(row.local_json),
      remoteJson: toJsonString(row.remote_json),
      resolutionJson: row.resolution_json ? toJsonString(row.resolution_json) : undefined,
      status: row.status,
    })),
    agentRuns: (runsRes.data ?? []).map((row) => ({
      id: row.id,
      studentId: row.student_id,
      model: row.model,
      objective: row.objective,
      contextScope: row.context_scope,
      status: row.status,
      autonomous: Boolean(row.autonomous),
      createdAt: row.created_at,
    })),
    agentActions: (actionsRes.data ?? []).map((row) => ({
      id: row.id,
      runId: row.run_id,
      actionType: row.action_type,
      actionKind: row.action_kind,
      safetyClass: row.safety_class,
      targetEntity: row.target_entity,
      targetId: row.target_id,
      title: row.title,
      detail: row.detail,
      diffJson: toJsonString(row.diff_json),
      approved: Boolean(row.approved),
      appliedAt: row.applied_at ?? undefined,
    })),
    snapshots: (snapshotsRes.data ?? []).map((row) => ({
      id: row.id,
      studentId: row.student_id,
      batchId: row.batch_id,
      snapshotJson: toJsonString(row.snapshot_json),
      createdAt: row.created_at,
    })),
    auditEvents: (auditsRes.data ?? []).map((row) => ({
      id: row.id,
      timestamp: row.timestamp,
      actorType: row.actor_type,
      actorId: row.actor_id ?? undefined,
      source: row.source,
      entityType: row.entity_type,
      entityId: row.entity_id,
      actionType: row.action_type,
      beforeJson: row.before_json ? toJsonString(row.before_json) : undefined,
      afterJson: row.after_json ? toJsonString(row.after_json) : undefined,
      diffJson: row.diff_json ? toJsonString(row.diff_json) : undefined,
      correlationId: row.correlation_id,
      snapshotId: row.snapshot_id ?? undefined,
    })),
  };
}

export async function upsertStudentFromAuth(auth: AuthContext): Promise<Student> {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    const fallbackState = createSeedState(auth.clerkUserId);
    fallbackState.student = {
      ...fallbackState.student!,
      clerkUserId: auth.clerkUserId,
      name: auth.name ?? fallbackState.student?.name ?? "Student",
      email: auth.email ?? fallbackState.student?.email ?? "student@example.edu",
      updatedAt: ISO_NOW(),
    };
    mutateState((db) => {
      db.student = fallbackState.student;
    });
    return fallbackState.student;
  }

  const { data, error } = await supabase
    .from("students")
    .upsert(
      {
        clerk_user_id: auth.clerkUserId,
        name: auth.name ?? "Student",
        email: auth.email ?? `${auth.clerkUserId}@houra.local`,
        role: auth.role,
        is_approved: auth.isApproved,
        updated_at: ISO_NOW(),
      },
      { onConflict: "clerk_user_id" },
    )
    .select("*")
    .single<StudentRow>();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to upsert student");
  }

  return mapStudent(data);
}

export async function upsertStudentFromWebhook(input: {
  clerkUserId: string;
  name: string;
  email: string;
  role: "student" | "unknown";
  isApproved: boolean;
}) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return;
  }

  const { error } = await supabase.from("students").upsert(
    {
      clerk_user_id: input.clerkUserId,
      name: input.name,
      email: input.email,
      role: input.role,
      is_approved: input.isApproved,
      updated_at: ISO_NOW(),
    },
    { onConflict: "clerk_user_id" },
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function getBootstrap(auth: AuthContext): Promise<BootstrapPayload> {
  const student = await upsertStudentFromAuth(auth);
  const state = await fetchStateFromSupabase(student.id);
  state.student = student;

  return {
    auth,
    state,
  };
}

export async function getStateForStudent(studentId: string): Promise<HouraState> {
  return fetchStateFromSupabase(studentId);
}

export async function recordAuditEvent(event: AuditEvent): Promise<void> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    pushAudit(event);
    return;
  }

  const { error } = await supabase.from("audit_events").insert({
    id: event.id,
    timestamp: event.timestamp,
    actor_type: event.actorType,
    actor_id: event.actorId ?? null,
    source: event.source,
    entity_type: event.entityType,
    entity_id: event.entityId,
    action_type: event.actionType,
    before_json: toJsonValue(event.beforeJson),
    after_json: toJsonValue(event.afterJson),
    diff_json: toJsonValue(event.diffJson),
    correlation_id: event.correlationId,
    snapshot_id: event.snapshotId ?? null,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function listAuditEvents(input: {
  studentId: string;
  actorType?: string;
  entityType?: string;
  actionType?: string;
}): Promise<AuditEvent[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return filterAudit({
      actorType: input.actorType,
      entityType: input.entityType,
      actionType: input.actionType,
    });
  }

  let query = supabase
    .from("audit_events")
    .select("*")
    .order("timestamp", { ascending: false })
    .limit(500);

  if (input.actorType) query = query.eq("actor_type", input.actorType);
  if (input.entityType) query = query.eq("entity_type", input.entityType);
  if (input.actionType) query = query.eq("action_type", input.actionType);

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    timestamp: row.timestamp,
    actorType: row.actor_type,
    actorId: row.actor_id ?? undefined,
    source: row.source,
    entityType: row.entity_type,
    entityId: row.entity_id,
    actionType: row.action_type as ActionType,
    beforeJson: row.before_json ? toJsonString(row.before_json) : undefined,
    afterJson: row.after_json ? toJsonString(row.after_json) : undefined,
    diffJson: row.diff_json ? toJsonString(row.diff_json) : undefined,
    correlationId: row.correlation_id,
    snapshotId: row.snapshot_id ?? undefined,
  }));
}

export async function resolveSyncConflict(input: {
  studentId: string;
  conflictId: string;
  resolutionJson: string;
}): Promise<SyncConflict> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return resolveRuntimeConflict(input.conflictId, input.resolutionJson);
  }

  const { data, error } = await supabase
    .from("sync_conflicts")
    .update({
      status: "resolved",
      resolution_json: toJsonValue(input.resolutionJson),
      updated_at: ISO_NOW(),
    })
    .eq("id", input.conflictId)
    .eq("student_id", input.studentId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Conflict not found");
  }

  return {
    id: data.id,
    entityType: data.entity_type,
    entityId: data.entity_id,
    localJson: toJsonString(data.local_json),
    remoteJson: toJsonString(data.remote_json),
    resolutionJson: data.resolution_json ? toJsonString(data.resolution_json) : undefined,
    status: data.status,
  };
}

export async function writeImportResult(input: {
  studentId: string;
  sourceType: "csv" | "xlsx";
  confidenceJson: string;
  entries: ServiceEntry[];
}): Promise<ImportJob> {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    const job: ImportJob = {
      id: crypto.randomUUID(),
      studentId: input.studentId,
      sourceType: input.sourceType,
      status: "completed",
      confidenceJson: input.confidenceJson,
      createdAt: ISO_NOW(),
    };
    mutateState((db) => {
      db.entries.unshift(...input.entries);
      db.importJobs.unshift(job);
    });
    return job;
  }

  if (input.entries.length > 0) {
    const { error: entriesError } = await supabase.from("service_entries").insert(
      input.entries.map((entry) => ({
        id: entry.id,
        student_id: entry.studentId,
        organization_id: entry.organizationId,
        activity_name: entry.activityName,
        description: entry.description ?? null,
        start_at: entry.startAt,
        end_at: entry.endAt,
        duration_minutes: entry.durationMinutes,
        status: entry.status,
        reject_reason: entry.rejectReason ?? null,
        archived_at: entry.archivedAt ?? null,
        created_at: entry.createdAt,
        updated_at: entry.updatedAt,
      })),
    );

    if (entriesError) {
      throw new Error(entriesError.message);
    }
  }

  const { data, error } = await supabase
    .from("import_jobs")
    .insert({
      student_id: input.studentId,
      source_type: input.sourceType,
      status: "completed",
      confidence_json: toJsonValue(input.confidenceJson),
      created_at: ISO_NOW(),
      updated_at: ISO_NOW(),
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create import job");
  }

  return {
    id: data.id,
    studentId: data.student_id,
    sourceType: data.source_type,
    status: data.status,
    confidenceJson: toJsonString(data.confidence_json),
    createdAt: data.created_at,
  };
}

export async function listEntriesByRange(input: {
  studentId: string;
  rangeStart: string;
  rangeEnd: string;
}) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    const state = readState();
    const start = new Date(input.rangeStart).getTime();
    const end = new Date(input.rangeEnd).getTime();
    return {
      entries: state.entries.filter((entry) => {
        const value = new Date(entry.startAt).getTime();
        return value >= start && value <= end;
      }),
      organizations: state.organizations,
    };
  }

  const [entriesRes, orgRes] = await Promise.all([
    supabase
      .from("service_entries")
      .select("*")
      .eq("student_id", input.studentId)
      .gte("start_at", input.rangeStart)
      .lte("start_at", input.rangeEnd)
      .is("deleted_at", null)
      .order("start_at", { ascending: true }),
    supabase
      .from("organizations")
      .select("id,name")
      .eq("student_id", input.studentId)
      .is("deleted_at", null),
  ]);

  if (entriesRes.error) throw new Error(entriesRes.error.message);
  if (orgRes.error) throw new Error(orgRes.error.message);

  const organizations = (orgRes.data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
  }));

  return {
    entries: (entriesRes.data ?? []).map((row) => ({
      id: row.id,
      studentId: row.student_id,
      organizationId: row.organization_id,
      activityName: row.activity_name,
      description: row.description ?? undefined,
      startAt: row.start_at,
      endAt: row.end_at,
      durationMinutes: row.duration_minutes,
      status: row.status,
      rejectReason: row.reject_reason ?? undefined,
      archivedAt: row.archived_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
    organizations,
  };
}

export async function upsertShareLink(input: {
  studentId: string;
  scopeJson: string;
  expiresAt: string;
}): Promise<ShareLink> {
  const supabase = getSupabaseServerClient();
  const link: ShareLink = {
    id: crypto.randomUUID(),
    studentId: input.studentId,
    tokenHash: crypto.randomUUID().replaceAll("-", ""),
    scopeJson: input.scopeJson,
    expiresAt: input.expiresAt,
    revokedAt: null,
  };

  if (!supabase) {
    mutateState((db) => {
      db.shareLinks.unshift(link);
    });
    return link;
  }

  const { error } = await supabase.from("share_links").insert({
    id: link.id,
    student_id: link.studentId,
    token_hash: link.tokenHash,
    scope_json: toJsonValue(link.scopeJson),
    expires_at: link.expiresAt,
    revoked_at: null,
    created_at: ISO_NOW(),
  });

  if (error) throw new Error(error.message);
  return link;
}

export async function revokeShareLink(input: { studentId: string; linkId: string }): Promise<void> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    mutateState((db) => {
      db.shareLinks = db.shareLinks.map((link) =>
        link.id === input.linkId ? { ...link, revokedAt: ISO_NOW() } : link,
      );
    });
    return;
  }

  const { error } = await supabase
    .from("share_links")
    .update({ revoked_at: ISO_NOW() })
    .eq("id", input.linkId)
    .eq("student_id", input.studentId);

  if (error) throw new Error(error.message);
}

export async function writeAgentRunAndActions(input: {
  run: AgentRun;
  actions: AgentAction[];
}) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    writeAgentRun(input.run, input.actions);
    return;
  }

  const { error: runError } = await supabase.from("agent_runs").insert({
    id: input.run.id,
    student_id: input.run.studentId,
    model: input.run.model,
    objective: input.run.objective,
    context_scope: input.run.contextScope,
    status: input.run.status,
    autonomous: input.run.autonomous,
    created_at: input.run.createdAt,
    updated_at: ISO_NOW(),
  });
  if (runError) throw new Error(runError.message);

  if (input.actions.length === 0) {
    return;
  }

  const { error: actionsError } = await supabase.from("agent_actions").insert(
    input.actions.map((action) => ({
      id: action.id,
      run_id: action.runId,
      action_type: action.actionType,
      action_kind: action.actionKind,
      safety_class: action.safetyClass,
      target_entity: action.targetEntity,
      target_id: action.targetId,
      title: action.title,
      detail: action.detail,
      diff_json: toJsonValue(action.diffJson),
      approved: action.approved,
      applied_at: action.appliedAt ?? null,
      created_at: ISO_NOW(),
    })),
  );

  if (actionsError) throw new Error(actionsError.message);
}

export async function listAgentActionsByRun(runId: string): Promise<AgentAction[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return readState().agentActions.filter((action) => action.runId === runId);
  }

  const { data, error } = await supabase
    .from("agent_actions")
    .select("*")
    .eq("run_id", runId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id,
    runId: row.run_id,
    actionType: row.action_type,
    actionKind: row.action_kind,
    safetyClass: row.safety_class,
    targetEntity: row.target_entity,
    targetId: row.target_id,
    title: row.title,
    detail: row.detail,
    diffJson: toJsonString(row.diff_json),
    approved: Boolean(row.approved),
    appliedAt: row.applied_at ?? undefined,
  }));
}

export async function updateAgentRunStatus(input: { runId: string; status: AgentRun["status"] }) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    mutateState((db) => {
      db.agentRuns = db.agentRuns.map((run) =>
        run.id === input.runId ? { ...run, status: input.status } : run,
      );
    });
    return;
  }

  const { error } = await supabase
    .from("agent_runs")
    .update({ status: input.status, updated_at: ISO_NOW() })
    .eq("id", input.runId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function markAgentActionsApplied(input: {
  actionIds: string[];
  appliedAt: string;
}): Promise<void> {
  if (input.actionIds.length === 0) {
    return;
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    updateAgentActions(input.actionIds, {
      approved: true,
      actionType: "apply",
      appliedAt: input.appliedAt,
    });
    return;
  }

  const { error } = await supabase
    .from("agent_actions")
    .update({
      approved: true,
      action_type: "apply",
      applied_at: input.appliedAt,
    })
    .in("id", input.actionIds);

  if (error) throw new Error(error.message);
}

export async function writeSnapshot(snapshot: StateSnapshot) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    pushSnapshot(snapshot);
    return;
  }

  const { error } = await supabase.from("state_snapshots").insert({
    id: snapshot.id,
    student_id: snapshot.studentId,
    batch_id: snapshot.batchId,
    snapshot_json: toJsonValue(snapshot.snapshotJson),
    created_at: snapshot.createdAt,
  });

  if (error) throw new Error(error.message);
}

export async function applyAgentActionEffects(input: {
  action: AgentAction;
  now: string;
  studentId: string;
}) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    mutateState((db) => {
      if (input.action.targetEntity === "serviceEntry" && input.action.actionKind === "status_normalization") {
        db.entries = db.entries.map((entry) =>
          entry.id === input.action.targetId ? { ...entry, status: "Verified", updatedAt: input.now } : entry,
        );
      }
      if (input.action.targetEntity === "shareLink" && input.action.actionKind === "share_link_change") {
        db.shareLinks = db.shareLinks.map((link) =>
          link.id === input.action.targetId ? { ...link, revokedAt: input.now } : link,
        );
      }
      if (input.action.targetEntity === "syncQueueItem" && input.action.actionKind === "sync_retry") {
        db.syncQueue = db.syncQueue.map((item) =>
          item.id === input.action.targetId ? { ...item, status: "Uploading" } : item,
        );
      }
    });
    return;
  }

  if (input.action.targetEntity === "serviceEntry" && input.action.actionKind === "status_normalization") {
    const { error } = await supabase
      .from("service_entries")
      .update({ status: "Verified", updated_at: input.now })
      .eq("id", input.action.targetId)
      .eq("student_id", input.studentId);
    if (error) throw new Error(error.message);
    return;
  }

  if (input.action.targetEntity === "shareLink" && input.action.actionKind === "share_link_change") {
    const { error } = await supabase
      .from("share_links")
      .update({ revoked_at: input.now })
      .eq("id", input.action.targetId)
      .eq("student_id", input.studentId);
    if (error) throw new Error(error.message);
    return;
  }

  if (input.action.targetEntity === "syncQueueItem" && input.action.actionKind === "sync_retry") {
    const { error } = await supabase
      .from("sync_queue_items")
      .update({ status: "Uploading", updated_at: input.now })
      .eq("id", input.action.targetId)
      .eq("student_id", input.studentId);
    if (error) throw new Error(error.message);
  }
}

export async function upsertOrganizationByName(input: {
  studentId: string;
  orgName: string;
}): Promise<Organization> {
  const normalized = input.orgName.trim();
  if (!normalized) {
    throw new Error("Organization name is required");
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    let found: Organization | undefined;
    mutateState((db) => {
      found = db.organizations.find(
        (item) =>
          item.studentId === input.studentId && item.name.toLowerCase() === normalized.toLowerCase(),
      );

      if (!found) {
        found = {
          id: crypto.randomUUID(),
          studentId: input.studentId,
          name: normalized,
          evidenceRequired: false,
          archivedAt: null,
        };
        db.organizations.unshift(found);
      }
    });
    return found!;
  }

  const { data: existing, error: existingError } = await supabase
    .from("organizations")
    .select("*")
    .eq("student_id", input.studentId)
    .ilike("name", normalized)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existing) {
    return {
      id: existing.id,
      studentId: existing.student_id,
      name: existing.name,
      email: existing.email ?? undefined,
      phone: existing.phone ?? undefined,
      evidenceRequired: Boolean(existing.evidence_required),
      archivedAt: existing.archived_at,
    };
  }

  const { data, error } = await supabase
    .from("organizations")
    .insert({
      student_id: input.studentId,
      name: normalized,
      evidence_required: false,
      created_at: ISO_NOW(),
      updated_at: ISO_NOW(),
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create organization");
  }

  return {
    id: data.id,
    studentId: data.student_id,
    name: data.name,
    email: data.email ?? undefined,
    phone: data.phone ?? undefined,
    evidenceRequired: Boolean(data.evidence_required),
    archivedAt: data.archived_at,
  };
}

export async function createServiceEntry(input: {
  id?: string;
  studentId: string;
  organizationId: string;
  activityName: string;
  description?: string;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  status?: ServiceEntry["status"];
}): Promise<ServiceEntry> {
  const entry: ServiceEntry = {
    id: input.id ?? crypto.randomUUID(),
    studentId: input.studentId,
    organizationId: input.organizationId,
    activityName: input.activityName,
    description: input.description,
    startAt: input.startAt,
    endAt: input.endAt,
    durationMinutes: input.durationMinutes,
    status: input.status ?? "Pending Review",
    createdAt: ISO_NOW(),
    updatedAt: ISO_NOW(),
  };

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    mutateState((db) => {
      db.entries.unshift(entry);
    });
    return entry;
  }

  const { data, error } = await supabase
    .from("service_entries")
    .insert({
      id: entry.id,
      student_id: entry.studentId,
      organization_id: entry.organizationId,
      activity_name: entry.activityName,
      description: entry.description ?? null,
      start_at: entry.startAt,
      end_at: entry.endAt,
      duration_minutes: entry.durationMinutes,
      status: entry.status,
      created_at: entry.createdAt,
      updated_at: entry.updatedAt,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create entry");
  }

  return {
    id: data.id,
    studentId: data.student_id,
    organizationId: data.organization_id,
    activityName: data.activity_name,
    description: data.description ?? undefined,
    startAt: data.start_at,
    endAt: data.end_at,
    durationMinutes: data.duration_minutes,
    status: data.status,
    rejectReason: data.reject_reason ?? undefined,
    archivedAt: data.archived_at,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function bulkUpdateEntryStatus(input: {
  studentId: string;
  entryIds: string[];
  status: Extract<ServiceEntry["status"], "Verified" | "Rejected" | "Pending Review" | "Exported">;
  rejectReason?: string;
  decidedByStudentId?: string;
  aiSuggested?: boolean;
}): Promise<ServiceEntry[]> {
  if (input.entryIds.length === 0) {
    return [];
  }

  const now = ISO_NOW();
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    const updated: ServiceEntry[] = [];
    mutateState((db) => {
      db.entries = db.entries.map((entry) => {
        if (!input.entryIds.includes(entry.id)) return entry;
        const next: ServiceEntry = {
          ...entry,
          status: input.status,
          rejectReason: input.status === "Rejected" ? input.rejectReason ?? "Rejected" : undefined,
          updatedAt: now,
        };
        updated.push(next);
        return next;
      });
    });
    return updated;
  }

  const { data, error } = await supabase
    .from("service_entries")
    .update({
      status: input.status,
      reject_reason: input.status === "Rejected" ? input.rejectReason ?? "Rejected" : null,
      updated_at: now,
    })
    .eq("student_id", input.studentId)
    .in("id", input.entryIds)
    .select("*");

  if (error) {
    throw new Error(error.message);
  }

  if (input.status === "Verified" || input.status === "Rejected") {
    const decisionRows = (data ?? []).map((row) => ({
      entry_id: row.id,
      decision: input.status,
      reason: input.status === "Rejected" ? input.rejectReason ?? "Rejected" : "Verified",
      decided_by_student_id: input.decidedByStudentId ?? input.studentId,
      decided_at: now,
      ai_suggested: Boolean(input.aiSuggested),
    }));

    if (decisionRows.length > 0) {
      const { error: decisionError } = await supabase.from("verification_decisions").insert(decisionRows);
      if (decisionError) {
        throw new Error(decisionError.message);
      }
    }
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    studentId: row.student_id,
    organizationId: row.organization_id,
    activityName: row.activity_name,
    description: row.description ?? undefined,
    startAt: row.start_at,
    endAt: row.end_at,
    durationMinutes: row.duration_minutes,
    status: row.status,
    rejectReason: row.reject_reason ?? undefined,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}
