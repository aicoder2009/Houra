"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SectionHeader } from "@/components/layout/section-header";
import { formatIsoDateTime } from "@/lib/format";
import { useAppStore } from "@/lib/store/app-store";

export default function AuditPage() {
  const auditEvents = useAppStore((state) => state.auditEvents);
  const [actorType, setActorType] = useState("");
  const [entityType, setEntityType] = useState("");
  const [actionType, setActionType] = useState("");

  const filtered = useMemo(
    () =>
      auditEvents.filter((event) => {
        if (actorType && event.actorType !== actorType) return false;
        if (entityType && event.entityType !== entityType) return false;
        if (actionType && event.actionType !== actionType) return false;
        return true;
      }),
    [actionType, actorType, auditEvents, entityType],
  );

  async function exportCsv() {
    const params = new URLSearchParams();
    if (actorType) params.set("actorType", actorType);
    if (entityType) params.set("entityType", entityType);
    if (actionType) params.set("actionType", actionType);
    params.set("format", "csv");

    const response = await fetch(`/api/audit-events?${params.toString()}`);
    if (!response.ok) return;

    const csv = await response.text();
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "houra-audit.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <SectionHeader
        title="Audit Trail"
        subtitle="Immutable timeline of manual and autonomous mutations with filterable history."
        actions={
          <Button size="sm" variant="outline" onClick={exportCsv}>
            <Download data-icon="inline-start" />
            Export CSV
          </Button>
        }
      />

      <Card className="border-border/70 bg-panel/85">
        <CardHeader>
          <CardTitle className="text-sm">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 md:grid-cols-3">
            <Input placeholder="actorType (student/ai_agent)" value={actorType} onChange={(event) => setActorType(event.target.value)} />
            <Input placeholder="entityType" value={entityType} onChange={(event) => setEntityType(event.target.value)} />
            <Input placeholder="actionType" value={actionType} onChange={(event) => setActionType(event.target.value)} />
          </div>

          <div className="space-y-2">
            {filtered.map((event) => (
              <div key={event.id} className="rounded-md border border-border/70 bg-surface/60 p-3 text-xs">
                <div className="mb-1 flex items-center justify-between">
                  <p className="font-medium">
                    {event.actorType} · {event.actionType}
                  </p>
                  <span className="text-[11px] text-muted-foreground">{formatIsoDateTime(event.timestamp)}</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {event.entityType} ({event.entityId.slice(0, 8)}...) · correlation {event.correlationId.slice(0, 8)}
                </p>
                {event.diffJson ? (
                  <pre className="mt-2 overflow-auto rounded border border-border/70 bg-white/90 p-2 text-[10px] text-muted-foreground">
                    {event.diffJson}
                  </pre>
                ) : null}
              </div>
            ))}
            {filtered.length === 0 ? <p className="text-xs text-muted-foreground">No matching audit events.</p> : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
