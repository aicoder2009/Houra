"use client";

import { useMemo } from "react";
import { Building2, FileText, Target, CalendarClock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/layout/section-header";
import { formatIsoDate } from "@/lib/format";
import { useAppStore } from "@/lib/store/app-store";

export default function OrganizationsPage() {
  const allOrganizations = useAppStore((state) => state.organizations);
  const goals = useAppStore((state) => state.goals);
  const opportunities = useAppStore((state) => state.opportunities);
  const entries = useAppStore((state) => state.entries);
  const selectedOrganizationId = useAppStore((state) => state.selectedOrganizationId);
  const selectOrganization = useAppStore((state) => state.selectOrganization);
  const organizations = useMemo(
    () => allOrganizations.filter((org) => !org.archivedAt),
    [allOrganizations],
  );

  const selected = organizations.find((org) => org.id === selectedOrganizationId) ?? organizations[0];

  const selectedGoals = goals.filter((goal) => goal.organizationId === selected?.id);
  const selectedOpportunities = opportunities.filter((item) => item.organizationId === selected?.id);
  const selectedEntries = entries.filter((entry) => entry.organizationId === selected?.id);

  return (
    <div>
      <SectionHeader
        title="Organizations"
        subtitle="Private organization workspaces with goals, activity, documents, and opportunities."
      />

      <div className="grid gap-3 xl:grid-cols-[320px_1fr]">
        <Card className="border-border/70 bg-panel/85">
          <CardHeader>
            <CardTitle className="text-sm">Your Organizations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {organizations.map((org) => {
              const totalHours = entries
                .filter((entry) => entry.organizationId === org.id)
                .reduce((sum, entry) => sum + entry.durationMinutes / 60, 0);
              const active = selected?.id === org.id;

              return (
                <button
                  key={org.id}
                  type="button"
                  onClick={() => selectOrganization(org.id)}
                  className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
                    active ? "border-primary bg-primary/5" : "border-border/70 bg-surface/60 hover:bg-surface"
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <p className="text-xs font-medium">{org.name}</p>
                    <Badge variant="outline">{totalHours.toFixed(1)}h</Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {org.evidenceRequired ? "Evidence required" : "Evidence optional"}
                  </p>
                </button>
              );
            })}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-panel/85">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Building2 className="size-4" />
              {selected?.name ?? "Select organization"}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 lg:grid-cols-2">
            <section className="rounded-md border border-border/70 bg-surface/60 p-3">
              <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold">
                <Target className="size-3.5" />
                Goals
              </h3>
              <div className="space-y-2 text-xs">
                {selectedGoals.length === 0 ? (
                  <p className="text-muted-foreground">No goals configured.</p>
                ) : (
                  selectedGoals.map((goal) => (
                    <div key={goal.id} className="rounded border border-border/70 bg-white/80 p-2">
                      <p className="font-medium">{goal.title}</p>
                      <p className="text-[11px] text-muted-foreground">Target {goal.targetHours}h · {goal.status}</p>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-md border border-border/70 bg-surface/60 p-3">
              <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold">
                <CalendarClock className="size-3.5" />
                Opportunities
              </h3>
              <div className="space-y-2 text-xs">
                {selectedOpportunities.length === 0 ? (
                  <p className="text-muted-foreground">No opportunities planned.</p>
                ) : (
                  selectedOpportunities.map((item) => (
                    <div key={item.id} className="rounded border border-border/70 bg-white/80 p-2">
                      <p className="font-medium">{item.title}</p>
                      <p className="text-[11px] text-muted-foreground">{formatIsoDate(item.date)} · {item.status}</p>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-md border border-border/70 bg-surface/60 p-3 lg:col-span-2">
              <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold">
                <FileText className="size-3.5" />
                Activity & Docs
              </h3>
              <p className="mb-2 text-[11px] text-muted-foreground">
                Documents are stored in private Supabase Storage with signed URL access.
              </p>
              <div className="space-y-2">
                {selectedEntries.slice(0, 5).map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between rounded border border-border/70 bg-white/80 p-2 text-xs">
                    <span>{entry.activityName}</span>
                    <span className="text-muted-foreground">{(entry.durationMinutes / 60).toFixed(1)}h</span>
                  </div>
                ))}
              </div>
              <div className="mt-3">
                <Button size="sm" variant="outline">Attach Organization Doc</Button>
              </div>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
