import type {
  AgentAction,
  AgentRun,
  AuditEvent,
  SyncConflict,
  SyncQueueItem,
} from "@/lib/schemas/types";

export interface AuthService {
  getCurrentUser(): Promise<{
    clerkUserId: string;
    sessionId: string | null;
    email: string | null;
    name: string | null;
    isApproved: boolean;
    role: "student" | "unknown";
  } | null>;
}

export interface FileStorageService {
  presignUpload(input: {
    fileName: string;
    contentType: string;
    sizeBytes: number;
  }): Promise<{
    storageKey: string;
    uploadUrl: string;
    expiresAt: string;
  }>;

  presignDownload(input: { storageKey: string }): Promise<{
    downloadUrl: string;
    expiresAt: string;
  }>;
}

export interface AgentService {
  run(input: {
    studentId: string;
    objective: string;
    contextScope: string;
    model: string;
    autonomous: boolean;
  }): Promise<{ run: AgentRun; actions: AgentAction[] }>;

  apply(input: {
    runId: string;
    actionIds: string[];
    approveDangerous: boolean;
    actorId: string;
    studentId: string;
  }): Promise<{ snapshotId: string; applied: AgentAction[] }>;

  undo(input: {
    snapshotId: string;
    actorId: string;
    studentId: string;
  }): Promise<{ success: true }>;
}

export interface OfflineSyncService {
  enqueue(item: SyncQueueItem): Promise<void>;
  flush(): Promise<{ processed: number }>;
  resolveConflict(input: {
    conflictId: string;
    resolutionJson: string;
  }): Promise<SyncConflict>;
}

export interface AuditService {
  list(filters?: {
    actorType?: string;
    entityType?: string;
    actionType?: string;
  }): Promise<AuditEvent[]>;
}
