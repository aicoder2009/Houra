"use client";

import { useEffect, useState } from "react";
import { Wifi, WifiOff, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAppStore, useMetrics } from "@/lib/store/app-store";

export function Topbar() {
  const { pendingCount, unsyncedCount } = useMetrics();
  const autonomousEnabled = useAppStore((state) => state.autonomousEnabled);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const syncOnline = () => {
      setIsOnline(navigator.onLine);
    };

    syncOnline();
    window.addEventListener("online", syncOnline);
    window.addEventListener("offline", syncOnline);

    return () => {
      window.removeEventListener("online", syncOnline);
      window.removeEventListener("offline", syncOnline);
    };
  }, []);

  return (
    <div className="glass-panel mb-3 flex h-11 items-center justify-between rounded-xl border border-border/70 bg-white/88 px-3">
      <div className="flex items-center gap-2">
        <Badge variant="outline">Pending {pendingCount}</Badge>
        <Badge variant={unsyncedCount > 0 ? "destructive" : "secondary"}>
          Unsynced {unsyncedCount}
        </Badge>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1 rounded-md border border-border/70 bg-surface/80 px-2 py-1">
          {isOnline ? <Wifi className="size-3" /> : <WifiOff className="size-3" />}
          <span>{isOnline ? "Online" : "Offline"}</span>
        </div>
        <div className="flex items-center gap-1 rounded-md border border-border/70 bg-surface/80 px-2 py-1">
          <Zap className="size-3" />
          <span>{autonomousEnabled ? "Agent Auto" : "Agent Paused"}</span>
        </div>
      </div>
    </div>
  );
}
