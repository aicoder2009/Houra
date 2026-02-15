"use client";

import { openDB } from "idb";
import type { SyncQueueItem } from "@/lib/schemas/types";
import type { OfflineSyncService } from "@/lib/services/interfaces";

const DB_NAME = "houra-v2";
const STORE = "sync_queue";

async function db() {
  return openDB(DB_NAME, 1, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(STORE)) {
        database.createObjectStore(STORE, { keyPath: "id" });
      }
    },
  });
}

export const indexedDbSyncService: OfflineSyncService = {
  async enqueue(item) {
    await upsertIndexedQueueItem(item);
  },

  async flush() {
    const allItems = await readIndexedQueue();
    return { processed: allItems.length };
  },

  async resolveConflict(input) {
    const response = await fetch("/api/sync/resolve-conflict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error("Failed to resolve conflict");
    }

    return response.json();
  },
};

export async function readIndexedQueue(): Promise<SyncQueueItem[]> {
  const database = await db();
  return (await database.getAll(STORE)) as SyncQueueItem[];
}

export async function upsertIndexedQueueItem(item: SyncQueueItem): Promise<void> {
  const database = await db();
  await database.put(STORE, item);
}

export async function deleteIndexedQueueItem(id: string): Promise<void> {
  const database = await db();
  await database.delete(STORE, id);
}
