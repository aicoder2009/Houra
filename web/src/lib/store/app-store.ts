"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
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

  enqueueSync: (item: SyncQueueItem) => void;
  addAgentUiEvent: (event: Omit<AgentUiEvent, "id" | "time">) => void;
  hydrateBootstrap: (state: HouraState) => void;
};

const initial = createSeedState();

function toDurationMinutes(hours: number) {
  return Math.max(1, Math.round(hours * 60));
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
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

        trackEvent("entry_created", { source: "quick_add" });
      },

      bulkVerifySelected: () => {
        const selected = new Set(get().selectedLogIds);
        if (selected.size === 0) return;

        set((state) => ({
          entries: state.entries.map((entry) =>
            selected.has(entry.id)
              ? { ...entry, status: "Verified", updatedAt: nowIso(), rejectReason: undefined }
              : entry,
          ),
        }));

        trackEvent("bulk_verify", { count: selected.size });
      },

      bulkRejectSelected: (reason) => {
        const selected = new Set(get().selectedLogIds);
        if (selected.size === 0) return;

        set((state) => ({
          entries: state.entries.map((entry) =>
            selected.has(entry.id)
              ? { ...entry, status: "Rejected", updatedAt: nowIso(), rejectReason: reason }
              : entry,
          ),
        }));

        trackEvent("bulk_reject", { count: selected.size });
      },

      createShareLink: (scopeJson, expiry) => {
        const state = get();
        if (!state.student) return;

        const link: ShareLink = {
          id: crypto.randomUUID(),
          studentId: state.student.id,
          tokenHash: crypto.randomUUID().replaceAll("-", ""),
          scopeJson,
          expiresAt: expiry,
          revokedAt: null,
        };

        set({ shareLinks: [link, ...state.shareLinks] });
      },

      revokeShareLink: (id) => {
        set((state) => ({
          shareLinks: state.shareLinks.map((link) =>
            link.id === id ? { ...link, revokedAt: nowIso() } : link,
          ),
        }));
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
              studentId: state.student.id,
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
            agentRuns: [payload.run, ...current.agentRuns],
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
            actorId: state.student.id,
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

        get().addAgentUiEvent({
          type: "success",
          text: `Applied ${payload.applied.length} actions.`,
        });
      },

      undoSnapshot: async (snapshotId) => {
        const state = get();
        if (!state.student) return;

        const response = await fetch(`/api/snapshots/${snapshotId}/undo`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actorId: state.student.id }),
        });

        if (!response.ok) {
          get().addAgentUiEvent({ type: "warning", text: "Undo failed." });
          return;
        }

        get().addAgentUiEvent({ type: "info", text: "Undo event recorded." });
      },

      processSyncQueue: async () => {
        const queue = get().syncQueue;
        if (queue.length === 0) return;

        set((state) => ({
          syncQueue: state.syncQueue.map((item) => ({ ...item, status: "Synced", retryCount: 0 })),
        }));

        get().addAgentUiEvent({ type: "success", text: "Sync queue processed." });
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
            conflict.id === conflictId
              ? { ...conflict, status: "resolved", resolutionJson }
              : conflict,
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

        get().addAgentUiEvent({
          type: "success",
          text: `Import completed: ${payload.imported.length} rows, ${payload.skipped} skipped.`,
        });
      },

      enqueueSync: (item) => {
        set((state) => ({ syncQueue: [item, ...state.syncQueue] }));
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
        set({ ...state });
      },
    }),
    {
      name: "houra-v2-store-v2",
      onRehydrateStorage: () => {
        initPostHog();
      },
      partialize: (state) => ({
        student: state.student,
        organizations: state.organizations,
        goals: state.goals,
        opportunities: state.opportunities,
        entries: state.entries,
        evidenceAssets: state.evidenceAssets,
        verificationDecisions: state.verificationDecisions,
        reportPresets: state.reportPresets,
        shareLinks: state.shareLinks,
        importJobs: state.importJobs,
        syncQueue: state.syncQueue,
        conflicts: state.conflicts,
        agentRuns: state.agentRuns,
        agentActions: state.agentActions,
        snapshots: state.snapshots,
        auditEvents: state.auditEvents,
        selectedModel: state.selectedModel,
        objective: state.objective,
        autonomousEnabled: state.autonomousEnabled,
        autoApplySafe: state.autoApplySafe,
        approvalForDangerous: state.approvalForDangerous,
        agentEvents: state.agentEvents,
      }),
    },
  ),
);

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
