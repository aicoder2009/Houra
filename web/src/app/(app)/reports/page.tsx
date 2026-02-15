"use client";

import { useMemo, useState } from "react";
import { Download, Link2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SectionHeader } from "@/components/layout/section-header";
import { formatIsoDate } from "@/lib/format";
import { useAppStore } from "@/lib/store/app-store";

export default function ReportsPage() {
  const student = useAppStore((state) => state.student);
  const reportPresets = useAppStore((state) => state.reportPresets);
  const entries = useAppStore((state) => state.entries);
  const shareLinks = useAppStore((state) => state.shareLinks);

  const createShareLink = useAppStore((state) => state.createShareLink);
  const revokeShareLink = useAppStore((state) => state.revokeShareLink);

  const [selectedPresetId, setSelectedPresetId] = useState(reportPresets[0]?.id ?? "");
  const [rangeStart, setRangeStart] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10));
  const [rangeEnd, setRangeEnd] = useState(new Date().toISOString().slice(0, 10));
  const [exportResult, setExportResult] = useState<string>("");

  const selectedPreset = reportPresets.find((preset) => preset.id === selectedPresetId) ?? reportPresets[0];

  const totalHours = useMemo(
    () => entries.reduce((sum, entry) => sum + entry.durationMinutes / 60, 0),
    [entries],
  );

  async function onExport(format: "csv" | "pdf") {
    const response = await fetch("/api/reports/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        format,
        rangeStart: new Date(rangeStart).toISOString(),
        rangeEnd: new Date(rangeEnd).toISOString(),
        presetId: selectedPreset?.id,
      }),
    });

    if (!response.ok) {
      setExportResult("Export failed.");
      return;
    }

    const payload = (await response.json()) as { fileUrl: string; format: "csv" | "pdf" };
    setExportResult(`Generated ${payload.format.toUpperCase()} export: ${payload.fileUrl}`);
  }

  return (
    <div>
      <SectionHeader
        title="Reports"
        subtitle="Preset-driven exports, link sharing, and submission-ready report generation."
      />

      <div className="grid gap-3 xl:grid-cols-[320px_1fr]">
        <Card className="border-border/70 bg-panel/85">
          <CardHeader>
            <CardTitle className="text-sm">Presets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {reportPresets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setSelectedPresetId(preset.id)}
                className={`w-full rounded-md border px-3 py-2 text-left text-xs ${
                  selectedPresetId === preset.id
                    ? "border-primary bg-primary/5"
                    : "border-border/70 bg-surface/60 hover:bg-surface"
                }`}
              >
                <p className="font-medium">{preset.name}</p>
                <p className="text-[11px] text-muted-foreground">{preset.filtersJson}</p>
              </button>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-3">
          <Card className="border-border/70 bg-panel/85">
            <CardHeader>
              <CardTitle className="text-sm">Live Preview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <Input type="date" value={rangeStart} onChange={(event) => setRangeStart(event.target.value)} />
                <Input type="date" value={rangeEnd} onChange={(event) => setRangeEnd(event.target.value)} />
              </div>
              <div className="rounded-md border border-border/70 bg-surface/60 p-3">
                <p className="text-sm font-semibold">{selectedPreset?.name ?? "Preset"}</p>
                <p className="text-[11px] text-muted-foreground">Student: {student?.name ?? "Unknown"}</p>
                <p className="text-[11px] text-muted-foreground">Date range: {rangeStart} → {rangeEnd}</p>
                <p className="mt-2 text-xs">Total tracked hours: {totalHours.toFixed(1)}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => onExport("pdf")}>
                  <Download data-icon="inline-start" />
                  Export PDF
                </Button>
                <Button size="sm" variant="outline" onClick={() => onExport("csv")}>
                  <Download data-icon="inline-start" />
                  Export CSV
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    createShareLink(
                      JSON.stringify({ presetId: selectedPreset?.id, rangeStart, rangeEnd }),
                      new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
                    )
                  }
                >
                  <Link2 data-icon="inline-start" />
                  New Share Link
                </Button>
              </div>
              {exportResult ? <p className="text-[11px] text-muted-foreground">{exportResult}</p> : null}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-panel/85">
            <CardHeader>
              <CardTitle className="text-sm">Share Links</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {shareLinks.map((link) => (
                <div key={link.id} className="flex items-center justify-between rounded-md border border-border/70 bg-surface/60 px-3 py-2 text-xs">
                  <div>
                    <p className="font-medium">{link.tokenHash.slice(0, 12)}...</p>
                    <p className="text-[11px] text-muted-foreground">
                      Expires {formatIsoDate(link.expiresAt)}
                      {link.revokedAt ? " · Revoked" : ""}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" disabled={Boolean(link.revokedAt)} onClick={() => revokeShareLink(link.id)}>
                    <Trash2 data-icon="inline-start" />
                    Revoke
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
