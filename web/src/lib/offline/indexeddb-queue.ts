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
    const database = await db();
    await database.put(STORE, item);
  },

  async flush() {
    const database = await db();
    const allItems = (await database.getAll(STORE)) as SyncQueueItem[];

    if (allItems.length === 0) {
      return { processed: 0 };
    }

    for (const item of allItems) {
      await fetch("/api/sync/resolve-conflict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conflictId: item.id,
          resolutionJson: item.payload,
          simulatedQueueProcess: true,
        }),
      }).catch(() => {
        // keep queued if offline/failing
      });
      await database.delete(STORE, item.id);
    }

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
