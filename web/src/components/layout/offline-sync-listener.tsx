"use client";

import { useEffect } from "react";
import { useAppStore } from "@/lib/store/app-store";

export function OfflineSyncListener() {
  const processSyncQueue = useAppStore((state) => state.processSyncQueue);
  const addAgentUiEvent = useAppStore((state) => state.addAgentUiEvent);

  useEffect(() => {
    function onOnline() {
      addAgentUiEvent({ type: "info", text: "Connection restored. Sync worker running." });
      processSyncQueue().catch(() => {
        addAgentUiEvent({ type: "warning", text: "Sync worker failed after reconnect." });
      });
    }

    function onOffline() {
      addAgentUiEvent({ type: "warning", text: "Offline mode active. Mutations will queue." });
    }

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [addAgentUiEvent, processSyncQueue]);

  return null;
}
