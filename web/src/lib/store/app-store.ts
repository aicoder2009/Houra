"use client";

import { create } from "zustand";
import { createSeedState, modelOptions, nowIso } from "@/lib/schemas/seed";
import type {
  AgentAction,
  AgentRun,
  HouraState,
  ImportJob,
  ModelOption,
  ServiceEntry,
  ShareLink,
  SyncQueueItem,
  UUID,
} from "@/lib/schemas/types";
import { initPostHog, trackEvent } from "@/lib/posthog/client";
import {
  deleteIndexedQueueItem,
  readIndexedQueue,
  upsertIndexedQueueItem,
} from "@/lib/offline/indexeddb-queue";

export type AppSection =
  | "dashboard"
  | "organizations"
  | "logs"
  | "reports"
  | "calendar"
  | "sync"
  | "audit"
  | "settings";

type AgentUiEvent = {
  id: string;
  time: string;
  type: "info" | "success" | "warning";
  text: string;
};

type AppStore = HouraState & {
  section: AppSection;
  selectedModel: string;
  objective: string;
  autonomousEnabled: boolean;
  autoApplySafe: boolean;
  approvalForDangerous: boolean;
  selectedActionIds: string[];
  selectedLogIds: string[];
  selectedEntryId?: string;
  selectedOrganizationId?: string;
  selectedAuditEventId?: string;
  selectedPresetId?: string;
  selectedShareLinkId?: string;
  agentEvents: AgentUiEvent[];
  loadingAgent: boolean;
  modelOptions: readonly ModelOption[];
  bootstrapped: boolean;
  bootstrapError?: string;

  setSection: (section: AppSection) => void;
  setObjective: (objective: string) => void;
  setSelectedModel: (model: string) => void;
  setAutonomousEnabled: (enabled: boolean) => void;
  setAutoApplySafe: (enabled: boolean) => void;
  setApprovalForDangerous: (enabled: boolean) => void;
  toggleActionSelection: (id: string) => void;
  selectEntry: (id?: string) => void;
  selectOrganization: (id?: string) => void;
  selectLog: (id: string) => void;
  addServiceEntry: (input: {
    activityName: string;
    organizationId: string;
    hours: number;
    notes?: string;
    date: string;
  }) => void;
  bulkVerifySelected: () => void;
  bulkRejectSelected: (reason: string) => void;
  createShareLink: (scopeJson: string, expiry: string) => void;
  revokeShareLink: (id: string) => void;

  runAgentManually: (contextScope: string) => Promise<void>;
  applySelectedActions: () => Promise<void>;
  undoSnapshot: (snapshotId: string) => Promise<void>;
  processSyncQueue: () => Promise<void>;
  resolveConflict: (conflictId: string, resolutionJson: string) => Promise<void>;
  runImport: (file: File) => Promise<void>;
  refreshBootstrap: () => Promise<void>;
  hydrateOfflineQueue: () => Promise<void>;

  enqueueSync: (item: SyncQueueItem) => void;
  addAgentUiEvent: (event: Omit<AgentUiEvent, "id" | "time">) => void;
  hydrateBootstrap: (state: HouraState) => void;
};

const initial = createSeedState();

function toDurationMinutes(hours: number) {
  return Math.max(1, Math.round(hours * 60));
}

function isOnline() {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}

function parseQueuePayload<T>(payload: string): T | null {
  try {
    return JSON.parse(payload) as T;
  } catch {
    return null;
  }
}

export const useAppStore = create<AppStore>((set, get) => ({
  ...initial,
  section: "dashboard",
  selectedModel: modelOptions.find((option) => option.isDefault)?.value ?? modelOptions[0].value,
  objective: "Keep service logs submission-ready and resolve sync gaps autonomously.",
  autonomousEnabled: true,
  autoApplySafe: true,
  approvalForDangerous: true,
  selectedActionIds: [],
  selectedLogIds: [],
  selectedEntryId: initial.entries[0]?.id,
  selectedOrganizationId: initial.organizations[0]?.id,
  selectedAuditEventId: initial.auditEvents[0]?.id,
  selectedPresetId: initial.reportPresets[0]?.id,
  selectedShareLinkId: initial.shareLinks[0]?.id,
  agentEvents: [],
  loadingAgent: false,
  modelOptions,
  bootstrapped: false,

  setSection: (section) => set({ section }),
  setObjective: (objective) => set({ objective }),
  setSelectedModel: (selectedModel) => set({ selectedModel }),
  setAutonomousEnabled: (autonomousEnabled) => set({ autonomousEnabled }),
  setAutoApplySafe: (autoApplySafe) => set({ autoApplySafe }),
  setApprovalForDangerous: (approvalForDangerous) => set({ approvalForDangerous }),

  toggleActionSelection: (id) => {
    const current = get().selectedActionIds;
    set({
      selectedActionIds: current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    });
  },

  selectEntry: (selectedEntryId) => set({ selectedEntryId }),
  selectOrganization: (selectedOrganizationId) => set({ selectedOrganizationId }),
  selectLog: (id) => {
    const current = get().selectedLogIds;
    set({
      selectedLogIds: current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    });
  },

  addServiceEntry: (input) => {
    const state = get();
    if (!state.student) return;

    const entry: ServiceEntry = {
      id: crypto.randomUUID(),
      studentId: state.student.id,
      organizationId: input.organizationId,
      activityName: input.activityName,
      description: input.notes,
      startAt: input.date,
      endAt: input.date,
      durationMinutes: toDurationMinutes(input.hours),
      status: "Pending Review",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    const queueItem: SyncQueueItem = {
      id: crypto.randomUUID(),
      entityType: "serviceEntry",
      entityId: entry.id,
      operation: "create",
      payload: JSON.stringify(entry),
      status: "Queued",
      retryCount: 0,
      createdAt: nowIso(),
    };

    set({
      entries: [entry, ...state.entries],
      syncQueue: [queueItem, ...state.syncQueue],
      selectedEntryId: entry.id,
    });
    void upsertIndexedQueueItem(queueItem);

    trackEvent("entry_created", { source: "quick_add" });

    if (isOnline()) {
      void get().processSyncQueue();
    }
  },

  bulkVerifySelected: () => {
    const selectedIds = get().selectedLogIds;
    if (selectedIds.length === 0) return;

    const now = nowIso();
    const queueItem: SyncQueueItem = {
      id: crypto.randomUUID(),
      entityType: "serviceEntry",
      entityId: selectedIds[0],
      operation: "update",
      payload: JSON.stringify({ entryIds: selectedIds, status: "Verified" }),
      status: "Queued",
      retryCount: 0,
      createdAt: nowIso(),
    };

    set((state) => ({
      entries: state.entries.map((entry) =>
        selectedIds.includes(entry.id)
          ? { ...entry, status: "Verified", updatedAt: now, rejectReason: undefined }
          : entry,
      ),
      syncQueue: [queueItem, ...state.syncQueue],
    }));
    void upsertIndexedQueueItem(queueItem);

    trackEvent("bulk_verify", { count: selectedIds.length });
    if (isOnline()) {
      void get().processSyncQueue();
    }
  },

  bulkRejectSelected: (reason) => {
    const selectedIds = get().selectedLogIds;
    if (selectedIds.length === 0) return;

    const now = nowIso();
    const queueItem: SyncQueueItem = {
      id: crypto.randomUUID(),
      entityType: "serviceEntry",
      entityId: selectedIds[0],
      operation: "update",
      payload: JSON.stringify({ entryIds: selectedIds, status: "Rejected", rejectReason: reason }),
      status: "Queued",
      retryCount: 0,
      createdAt: nowIso(),
    };

    set((state) => ({
      entries: state.entries.map((entry) =>
        selectedIds.includes(entry.id)
          ? { ...entry, status: "Rejected", updatedAt: now, rejectReason: reason }
          : entry,
      ),
      syncQueue: [queueItem, ...state.syncQueue],
    }));
    void upsertIndexedQueueItem(queueItem);

    trackEvent("bulk_reject", { count: selectedIds.length });
    if (isOnline()) {
      void get().processSyncQueue();
    }
  },

  createShareLink: (scopeJson, expiry) => {
    const state = get();
    if (!state.student) return;

    const fallbackLink: ShareLink = {
      id: crypto.randomUUID(),
      studentId: state.student.id,
      tokenHash: crypto.randomUUID().replaceAll("-", ""),
      scopeJson,
      expiresAt: expiry,
      revokedAt: null,
    };

    set({ shareLinks: [fallbackLink, ...state.shareLinks] });

    if (!isOnline()) {
      get().enqueueSync({
        id: crypto.randomUUID(),
        entityType: "shareLink",
        entityId: fallbackLink.id,
        operation: "share",
        payload: JSON.stringify({ scopeJson, expiresAt: expiry, localId: fallbackLink.id }),
        status: "Queued",
        retryCount: 0,
        createdAt: nowIso(),
      });
      return;
    }

    void (async () => {
      try {
        const response = await fetch("/api/share-links", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scopeJson, expiresAt: expiry }),
        });
        if (!response.ok) throw new Error("Share link create failed");
        const payload = (await response.json()) as { link: ShareLink };
        set((current) => ({
          shareLinks: current.shareLinks.map((link) =>
            link.id === fallbackLink.id ? payload.link : link,
          ),
        }));
      } catch {
        get().addAgentUiEvent({
          type: "warning",
          text: "Share link queued for retry.",
        });
        get().enqueueSync({
          id: crypto.randomUUID(),
          entityType: "shareLink",
          entityId: fallbackLink.id,
          operation: "share",
          payload: JSON.stringify({ scopeJson, expiresAt: expiry, localId: fallbackLink.id }),
          status: "Queued",
          retryCount: 0,
          createdAt: nowIso(),
        });
      }
    })();
  },

  revokeShareLink: (id) => {
    const now = nowIso();
    set((state) => ({
      shareLinks: state.shareLinks.map((link) => (link.id === id ? { ...link, revokedAt: now } : link)),
    }));

    if (!isOnline()) {
      get().enqueueSync({
        id: crypto.randomUUID(),
        entityType: "shareLink",
        entityId: id,
        operation: "update",
        payload: JSON.stringify({ linkId: id }),
        status: "Queued",
        retryCount: 0,
        createdAt: nowIso(),
      });
      return;
    }

    void fetch(`/api/share-links/${id}/revoke`, { method: "POST" }).catch(() => {
      get().addAgentUiEvent({ type: "warning", text: "Share link revoke queued." });
      get().enqueueSync({
        id: crypto.randomUUID(),
        entityType: "shareLink",
        entityId: id,
        operation: "update",
        payload: JSON.stringify({ linkId: id }),
        status: "Queued",
        retryCount: 0,
        createdAt: nowIso(),
      });
    });
  },

  runAgentManually: async (contextScope) => {
    const state = get();
    if (!state.student) return;

    set({ loadingAgent: true });
    try {
      const response = await fetch("/api/agent/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objective: state.objective,
          contextScope,
          model: state.selectedModel,
          autonomous: false,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to run agent");
      }

      const payload = (await response.json()) as {
        run: AgentRun;
        actions: AgentAction[];
      };

      set((current) => ({
        agentRuns: [payload.run, ...current.agentRuns.filter((run) => run.id !== payload.run.id)],
        agentActions: [...payload.actions, ...current.agentActions],
        selectedActionIds: payload.actions.map((action) => action.id),
      }));

      get().addAgentUiEvent({
        type: "success",
        text: `Agent proposed ${payload.actions.length} actions.`,
      });
    } catch {
      get().addAgentUiEvent({ type: "warning", text: "Agent run failed." });
    } finally {
      set({ loadingAgent: false });
    }
  },

  applySelectedActions: async () => {
    const state = get();
    if (!state.student || state.selectedActionIds.length === 0) return;

    const run = state.agentRuns[0];
    if (!run) return;

    const response = await fetch("/api/agent/actions/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runId: run.id,
        actionIds: state.selectedActionIds,
        approveDangerous: state.approvalForDangerous,
      }),
    });

    if (!response.ok) {
      get().addAgentUiEvent({
        type: "warning",
        text: "Dangerous actions require approval toggle enabled.",
      });
      return;
    }

    const payload = (await response.json()) as {
      snapshotId: UUID;
      applied: AgentAction[];
    };

    set((current) => ({
      snapshots: [
        {
          id: payload.snapshotId,
          studentId: state.student?.id ?? "",
          batchId: run.id,
          snapshotJson: JSON.stringify({ actionIds: payload.applied.map((item) => item.id) }),
          createdAt: nowIso(),
        },
        ...current.snapshots,
      ],
      selectedActionIds: [],
      agentActions: current.agentActions.map((action) =>
        payload.applied.some((item) => item.id === action.id)
          ? { ...action, approved: true, actionType: "apply", appliedAt: nowIso() }
          : action,
      ),
    }));

    await get().refreshBootstrap();

    get().addAgentUiEvent({
      type: "success",
      text: `Applied ${payload.applied.length} actions.`,
    });
  },

  undoSnapshot: async (snapshotId) => {
    const response = await fetch(`/api/snapshots/${snapshotId}/undo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      get().addAgentUiEvent({ type: "warning", text: "Undo failed." });
      return;
    }

    await get().refreshBootstrap();
    get().addAgentUiEvent({ type: "info", text: "Undo event recorded." });
  },

  processSyncQueue: async () => {
    if (!isOnline()) {
      return;
    }

    const queue = get().syncQueue.filter((item) => item.status !== "Synced");
    if (queue.length === 0) return;

    for (const item of queue) {
      set((state) => ({
        syncQueue: state.syncQueue.map((row) =>
          row.id === item.id ? { ...row, status: "Uploading" } : row,
        ),
      }));

      try {
        if (item.entityType === "serviceEntry" && item.operation === "create") {
          const payload = parseQueuePayload<ServiceEntry>(item.payload);
          if (!payload) throw new Error("Invalid entry payload");
          const response = await fetch("/api/logs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: payload.id,
              organizationId: payload.organizationId,
              activityName: payload.activityName,
              description: payload.description,
              startAt: payload.startAt,
              endAt: payload.endAt,
              durationMinutes: payload.durationMinutes,
              status: payload.status,
            }),
          });
          if (!response.ok) throw new Error("Failed to sync created entry");
        } else if (item.entityType === "serviceEntry" && item.operation === "update") {
          const payload = parseQueuePayload<{
            entryIds: string[];
            status: "Verified" | "Rejected" | "Pending Review" | "Exported";
            rejectReason?: string;
          }>(item.payload);
          if (!payload) throw new Error("Invalid bulk status payload");
          const response = await fetch("/api/logs/bulk-status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (!response.ok) throw new Error("Failed to sync bulk status");
        } else if (item.entityType === "shareLink" && item.operation === "share") {
          const payload = parseQueuePayload<{
            scopeJson: string;
            expiresAt: string;
            localId: string;
          }>(item.payload);
          if (!payload) throw new Error("Invalid share link payload");
          const response = await fetch("/api/share-links", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              scopeJson: payload.scopeJson,
              expiresAt: payload.expiresAt,
            }),
          });
          if (!response.ok) throw new Error("Failed to sync share link create");
          const body = (await response.json()) as { link: ShareLink };
          set((state) => ({
            shareLinks: state.shareLinks.map((link) =>
              link.id === payload.localId ? body.link : link,
            ),
          }));
        } else if (item.entityType === "shareLink" && item.operation === "update") {
          const payload = parseQueuePayload<{ linkId: string }>(item.payload);
          if (!payload) throw new Error("Invalid share link revoke payload");
          const response = await fetch(`/api/share-links/${payload.linkId}/revoke`, { method: "POST" });
          if (!response.ok) throw new Error("Failed to sync share link revoke");
        }

        set((state) => ({
          syncQueue: state.syncQueue.map((row) =>
            row.id === item.id ? { ...row, status: "Synced", retryCount: 0 } : row,
          ),
        }));
        await deleteIndexedQueueItem(item.id);
      } catch {
        set((state) => ({
          syncQueue: state.syncQueue.map((row) =>
            row.id === item.id
              ? { ...row, status: "Failed", retryCount: row.retryCount + 1 }
              : row,
          ),
        }));
        const failed = get().syncQueue.find((row) => row.id === item.id);
        if (failed) {
          await upsertIndexedQueueItem(failed);
        }
      }
    }

    get().addAgentUiEvent({ type: "success", text: "Sync queue processed." });
    await get().refreshBootstrap();
  },

  resolveConflict: async (conflictId, resolutionJson) => {
    const response = await fetch("/api/sync/resolve-conflict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conflictId, resolutionJson }),
    });

    if (!response.ok) {
      get().addAgentUiEvent({
        type: "warning",
        text: "Conflict resolution failed.",
      });
      return;
    }

    set((state) => ({
      conflicts: state.conflicts.map((conflict) =>
        conflict.id === conflictId ? { ...conflict, status: "resolved", resolutionJson } : conflict,
      ),
    }));

    get().addAgentUiEvent({
      type: "success",
      text: "Conflict resolved.",
    });
  },

  runImport: async (file) => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/imports", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      get().addAgentUiEvent({ type: "warning", text: "Import failed." });
      return;
    }

    const payload = (await response.json()) as {
      job: ImportJob;
      imported: ServiceEntry[];
      skipped: number;
    };

    set((state) => ({
      importJobs: [payload.job, ...state.importJobs],
      entries: [...payload.imported, ...state.entries],
    }));

    await get().refreshBootstrap();

    get().addAgentUiEvent({
      type: "success",
      text: `Import completed: ${payload.imported.length} rows, ${payload.skipped} skipped.`,
    });
  },

  refreshBootstrap: async () => {
    try {
      const response = await fetch("/api/bootstrap", { method: "GET" });
      if (!response.ok) {
        throw new Error("Bootstrap fetch failed");
      }

      const payload = (await response.json()) as {
        state: HouraState;
      };
      get().hydrateBootstrap(payload.state);
    } catch {
      set({ bootstrapError: "Failed to load latest data", bootstrapped: true });
    }
  },

  enqueueSync: (item) => {
    set((state) => ({ syncQueue: [item, ...state.syncQueue] }));
    void upsertIndexedQueueItem(item);
  },

  hydrateOfflineQueue: async () => {
    const queued = await readIndexedQueue();
    if (queued.length === 0) return;

    set((state) => {
      const existing = new Set(state.syncQueue.map((item) => item.id));
      const merged = [...state.syncQueue];
      for (const item of queued) {
        if (!existing.has(item.id)) {
          merged.unshift(item);
        }
      }
      return { syncQueue: merged };
    });
  },

  addAgentUiEvent: (event) => {
    set((state) => ({
      agentEvents: [
        {
          id: crypto.randomUUID(),
          time: nowIso(),
          type: event.type,
          text: event.text,
        },
        ...state.agentEvents,
      ].slice(0, 40),
    }));
  },

  hydrateBootstrap: (state) => {
    set((current) => ({
      ...state,
      selectedEntryId: state.entries[0]?.id ?? current.selectedEntryId,
      selectedOrganizationId: state.organizations[0]?.id ?? current.selectedOrganizationId,
      selectedAuditEventId: state.auditEvents[0]?.id ?? current.selectedAuditEventId,
      selectedPresetId: state.reportPresets[0]?.id ?? current.selectedPresetId,
      selectedShareLinkId: state.shareLinks[0]?.id ?? current.selectedShareLinkId,
      bootstrapped: true,
      bootstrapError: undefined,
    }));
  },
}));

export function initializeClientTelemetry() {
  initPostHog();
}

export function useMetrics() {
  const entries = useAppStore((state) => state.entries);
  const syncQueue = useAppStore((state) => state.syncQueue);

  const totalHours = entries.reduce((sum, entry) => sum + entry.durationMinutes / 60, 0);
  const verifiedHours = entries
    .filter((entry) => entry.status === "Verified" || entry.status === "Exported")
    .reduce((sum, entry) => sum + entry.durationMinutes / 60, 0);

  const pendingCount = entries.filter((entry) => entry.status === "Pending Review").length;
  const unsyncedCount = syncQueue.filter((item) => item.status !== "Synced").length;

  return {
    totalHours,
    verifiedHours,
    pendingCount,
    unsyncedCount,
  };
}
