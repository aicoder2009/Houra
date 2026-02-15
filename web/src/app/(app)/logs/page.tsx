"use client";

import { useMemo, useState } from "react";
import { Upload, CheckSquare, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SectionHeader } from "@/components/layout/section-header";
import { StatusChip } from "@/components/domain/status-chip";
import { formatIsoDate } from "@/lib/format";
import { useAppStore } from "@/lib/store/app-store";

export default function LogsPage() {
  const allOrganizations = useAppStore((state) => state.organizations);
  const entries = useAppStore((state) => state.entries);
  const selectedLogIds = useAppStore((state) => state.selectedLogIds);
  const selectedEntryId = useAppStore((state) => state.selectedEntryId);

  const addServiceEntry = useAppStore((state) => state.addServiceEntry);
  const selectEntry = useAppStore((state) => state.selectEntry);
  const selectLog = useAppStore((state) => state.selectLog);
  const bulkVerifySelected = useAppStore((state) => state.bulkVerifySelected);
  const bulkRejectSelected = useAppStore((state) => state.bulkRejectSelected);
  const runImport = useAppStore((state) => state.runImport);
  const organizations = useMemo(
    () => allOrganizations.filter((org) => !org.archivedAt),
    [allOrganizations],
  );

  const [activityName, setActivityName] = useState("");
  const [hours, setHours] = useState("1");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [organizationId, setOrganizationId] = useState(() => organizations[0]?.id ?? "");
  const [notes, setNotes] = useState("");
  const [rejectReason, setRejectReason] = useState("Needs correction");

  const selectedEntry = useMemo(
    () => entries.find((entry) => entry.id === selectedEntryId) ?? entries[0],
    [entries, selectedEntryId],
  );
  const activeOrganizationId = organizationId || organizations[0]?.id || "";

  async function onImportFile(file: File | null) {
    if (!file) return;
    await runImport(file);
  }

  return (
    <div>
      <SectionHeader
        title="Logs"
        subtitle="Offline-first service entry logging with bulk verification and import."
        actions={
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border/70 bg-surface px-3 py-1.5 text-xs font-medium hover:bg-secondary">
            <Upload className="size-3.5" />
            Import CSV/XLSX
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(event) => onImportFile(event.target.files?.[0] ?? null)}
            />
          </label>
        }
      />

      <div className="grid gap-3 xl:grid-cols-[1.4fr_1fr]">
        <Card className="border-border/70 bg-panel/85">
          <CardHeader>
            <CardTitle className="text-sm">Service Entries</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-border/70 bg-surface/60 p-2">
              <Button size="sm" variant="secondary" onClick={bulkVerifySelected} disabled={selectedLogIds.length === 0}>
                <CheckSquare data-icon="inline-start" />
                Bulk Verify
              </Button>
              <Input
                value={rejectReason}
                onChange={(event) => setRejectReason(event.target.value)}
                className="h-6 w-56"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => bulkRejectSelected(rejectReason)}
                disabled={selectedLogIds.length === 0}
              >
                <XCircle data-icon="inline-start" />
                Bulk Reject
              </Button>
              <span className="text-[11px] text-muted-foreground">Selected: {selectedLogIds.length}</span>
            </div>

            <div className="max-h-[480px] space-y-2 overflow-y-auto">
              {entries.map((entry) => {
                const selected = selectedLogIds.includes(entry.id);
                return (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-border/70 bg-surface/60 px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => selectLog(entry.id)}
                        className="size-3.5"
                      />
                      <button type="button" className="text-left" onClick={() => selectEntry(entry.id)}>
                        <p className="text-xs font-medium">{entry.activityName}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {formatIsoDate(entry.startAt)} · {(entry.durationMinutes / 60).toFixed(1)}h
                        </p>
                      </button>
                    </div>
                    <StatusChip value={entry.status} />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <Card className="border-border/70 bg-panel/85">
            <CardHeader>
              <CardTitle className="text-sm">Add Entry</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Input
                placeholder="Activity name"
                value={activityName}
                onChange={(event) => setActivityName(event.target.value)}
              />
              <div className="grid grid-cols-2 gap-2">
                <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
                <Input type="number" min="0.25" step="0.25" value={hours} onChange={(event) => setHours(event.target.value)} />
              </div>
              <select
                value={activeOrganizationId}
                onChange={(event) => setOrganizationId(event.target.value)}
                className="h-7 w-full rounded-md border border-border bg-input/20 px-2 text-xs"
              >
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
              <Textarea placeholder="Notes" value={notes} onChange={(event) => setNotes(event.target.value)} className="min-h-20" />
              <Button
                className="w-full"
                onClick={() => {
                  if (!activityName || !activeOrganizationId || !hours) return;
                  addServiceEntry({
                    activityName,
                    organizationId: activeOrganizationId,
                    hours: Number(hours),
                    notes,
                    date: new Date(date).toISOString(),
                  });
                  setActivityName("");
                  setNotes("");
                }}
              >
                Save Pending Review
              </Button>
            </CardContent>
          </Card>

          {selectedEntry ? (
            <Card className="border-border/70 bg-panel/85">
              <CardHeader>
                <CardTitle className="text-sm">Selected Entry</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <p className="font-medium">{selectedEntry.activityName}</p>
                <p className="text-muted-foreground">{selectedEntry.description || "No description"}</p>
                <div className="flex items-center justify-between">
                  <span>{(selectedEntry.durationMinutes / 60).toFixed(2)} hours</span>
                  <StatusChip value={selectedEntry.status} />
                </div>
                {selectedEntry.rejectReason ? (
                  <p className="rounded border border-destructive/20 bg-destructive/10 px-2 py-1 text-[11px] text-destructive">
                    Reject reason: {selectedEntry.rejectReason}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
