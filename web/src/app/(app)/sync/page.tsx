"use client";

import { RefreshCw, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionHeader } from "@/components/layout/section-header";
import { StatusChip } from "@/components/domain/status-chip";
import { useAppStore } from "@/lib/store/app-store";

export default function SyncPage() {
  const syncQueue = useAppStore((state) => state.syncQueue);
  const conflicts = useAppStore((state) => state.conflicts);

  const processSyncQueue = useAppStore((state) => state.processSyncQueue);
  const resolveConflict = useAppStore((state) => state.resolveConflict);

  return (
    <div>
      <SectionHeader
        title="Sync Center"
        subtitle="Queue status, retry controls, and field-level conflict resolution."
        actions={
          <Button size="sm" onClick={() => processSyncQueue()}>
            <RefreshCw data-icon="inline-start" />
            Flush Queue
          </Button>
        }
      />

      <div className="grid gap-3 xl:grid-cols-2">
        <Card className="border-border/70 bg-panel/85">
          <CardHeader>
            <CardTitle className="text-sm">Mutation Queue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {syncQueue.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-md border border-border/70 bg-surface/60 px-3 py-2 text-xs">
                <div>
                  <p className="font-medium">{item.entityType}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {item.operation} · retries {item.retryCount}
                  </p>
                </div>
                <StatusChip value={item.status} />
              </div>
            ))}
            {syncQueue.length === 0 ? <p className="text-xs text-muted-foreground">Queue is empty.</p> : null}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-panel/85">
          <CardHeader>
            <CardTitle className="text-sm">Conflict Workbench</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {conflicts.map((conflict) => (
              <div key={conflict.id} className="rounded-md border border-border/70 bg-surface/60 p-3 text-xs">
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-medium">{conflict.entityType}</p>
                  <span className="text-[11px] text-muted-foreground">{conflict.status}</span>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <div className="rounded border border-border/70 bg-white/90 p-2">
                    <p className="mb-1 text-[11px] font-semibold">Local</p>
                    <pre className="overflow-auto text-[10px] text-muted-foreground">{conflict.localJson}</pre>
                  </div>
                  <div className="rounded border border-border/70 bg-white/90 p-2">
                    <p className="mb-1 text-[11px] font-semibold">Remote</p>
                    <pre className="overflow-auto text-[10px] text-muted-foreground">{conflict.remoteJson}</pre>
                  </div>
                </div>
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={conflict.status === "resolved"}
                    onClick={() => resolveConflict(conflict.id, conflict.localJson)}
                  >
                    <Shuffle data-icon="inline-start" />
                    Choose Local
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={conflict.status === "resolved"}
                    onClick={() => resolveConflict(conflict.id, conflict.remoteJson)}
                  >
                    <Shuffle data-icon="inline-start" />
                    Choose Remote
                  </Button>
                </div>
              </div>
            ))}
            {conflicts.length === 0 ? <p className="text-xs text-muted-foreground">No conflicts detected.</p> : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
