"use client";

import { AlertTriangle, CheckCircle2, Clock3, Sparkles } from "lucide-react";
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/layout/section-header";
import { MetricCard } from "@/components/domain/metric-card";
import { formatIsoDate } from "@/lib/format";
import { useAppStore, useMetrics } from "@/lib/store/app-store";
import { StatusChip } from "@/components/domain/status-chip";

export default function DashboardPage() {
  const { totalHours, verifiedHours, pendingCount, unsyncedCount } = useMetrics();
  const goals = useAppStore((state) => state.goals);
  const allEntries = useAppStore((state) => state.entries);
  const autonomousEnabled = useAppStore((state) => state.autonomousEnabled);
  const entries = useMemo(() => allEntries.slice(0, 6), [allEntries]);

  const riskGoals = goals.filter((goal) => goal.status === "Behind");

  return (
    <div>
      <SectionHeader
        title="Dashboard"
        subtitle="Student workspace overview with autonomous Agent status and submission risk signals."
      />

      <section className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total Hours" value={totalHours.toFixed(1)} hint="All tracked entries" />
        <MetricCard label="Verified Hours" value={verifiedHours.toFixed(1)} hint="Ready for export" />
        <MetricCard label="Pending Review" value={String(pendingCount)} hint="Needs decision" />
        <MetricCard label="Unsynced" value={String(unsyncedCount)} hint="Offline queue state" />
      </section>

      <section className="grid gap-3 xl:grid-cols-[1.5fr_1fr]">
        <Card className="border-border/70 bg-panel/85">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Clock3 className="size-4" />
              Latest Service Entries
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {entries.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between rounded-md border border-border/70 bg-surface/60 px-3 py-2">
                <div>
                  <p className="text-xs font-medium">{entry.activityName}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatIsoDate(entry.startAt)} · {(entry.durationMinutes / 60).toFixed(1)}h
                  </p>
                </div>
                <StatusChip value={entry.status} />
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-3">
          <Card className="border-border/70 bg-panel/85">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Sparkles className="size-4" />
                Agent Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <Badge variant={autonomousEnabled ? "secondary" : "outline"}>
                  {autonomousEnabled ? "Autonomous" : "Paused"}
                </Badge>
                <span className="text-muted-foreground">
                  {autonomousEnabled ? "Safe actions auto-apply" : "Manual runs only"}
                </span>
              </div>
              <p className="text-muted-foreground">Dangerous action classes always require explicit approval.</p>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-panel/85">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                {riskGoals.length > 0 ? <AlertTriangle className="size-4" /> : <CheckCircle2 className="size-4" />}
                Goals at Risk
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              {riskGoals.length === 0 ? (
                <p className="text-muted-foreground">No goals currently behind target.</p>
              ) : (
                riskGoals.map((goal) => (
                  <div key={goal.id} className="rounded-md border border-border/70 bg-surface/60 p-2">
                    <p className="font-medium">{goal.title}</p>
                    <p className="text-[11px] text-muted-foreground">Due {formatIsoDate(goal.dueDate)}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
