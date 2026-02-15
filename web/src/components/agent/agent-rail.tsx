"use client";

import { useMemo } from "react";
import { Play, Pause, History, ShieldAlert, ShieldCheck, Bot } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatIsoTime } from "@/lib/format";
import { useAppStore } from "@/lib/store/app-store";
import { cn } from "@/lib/utils";

export function AgentRail() {
  const objective = useAppStore((state) => state.objective);
  const selectedModel = useAppStore((state) => state.selectedModel);
  const modelOptions = useAppStore((state) => state.modelOptions);
  const autonomousEnabled = useAppStore((state) => state.autonomousEnabled);
  const loadingAgent = useAppStore((state) => state.loadingAgent);
  const selectedActionIds = useAppStore((state) => state.selectedActionIds);
  const agentActions = useAppStore((state) => state.agentActions);
  const agentRuns = useAppStore((state) => state.agentRuns);
  const agentEvents = useAppStore((state) => state.agentEvents);
  const snapshots = useAppStore((state) => state.snapshots);

  const setObjective = useAppStore((state) => state.setObjective);
  const setSelectedModel = useAppStore((state) => state.setSelectedModel);
  const setAutonomousEnabled = useAppStore((state) => state.setAutonomousEnabled);
  const toggleActionSelection = useAppStore((state) => state.toggleActionSelection);
  const runAgentManually = useAppStore((state) => state.runAgentManually);
  const applySelectedActions = useAppStore((state) => state.applySelectedActions);
  const undoSnapshot = useAppStore((state) => state.undoSnapshot);

  const latestRun = agentRuns[0];

  const pendingActions = useMemo(
    () =>
      agentActions.filter(
        (action) => action.actionType === "propose" && !action.approved && (!latestRun || action.runId === latestRun.id),
      ),
    [agentActions, latestRun],
  );

  const nextRunText = autonomousEnabled ? "Next auto cycle: ~15m" : "Autonomy paused";

  return (
    <aside className="glass-panel hidden h-full min-w-[340px] max-w-[380px] flex-col rounded-2xl border border-border/70 bg-white/90 p-3 xl:flex">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-md border border-border/70 bg-surface">
            <Bot className="size-4" />
          </div>
          <div>
            <p className="text-sm font-semibold">Agent</p>
            <p className="text-[11px] text-muted-foreground">Autonomous operator</p>
          </div>
        </div>
        <Badge variant={autonomousEnabled ? "secondary" : "outline"}>
          {autonomousEnabled ? "Autonomous" : "Paused"}
        </Badge>
      </div>

      <Card size="sm" className="mb-3 border-border/70 bg-panel/85">
        <CardHeader>
          <CardTitle className="text-xs">Objective</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Textarea
            value={objective}
            onChange={(event) => setObjective(event.target.value)}
            className="min-h-20 text-xs"
          />
          <div className="flex items-center gap-2">
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Model" />
              </SelectTrigger>
              <SelectContent>
                {modelOptions.map((option) => (
                  <SelectItem key={option.id} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant={autonomousEnabled ? "outline" : "secondary"}
              onClick={() => setAutonomousEnabled(!autonomousEnabled)}
            >
              {autonomousEnabled ? <Pause data-icon="inline-start" /> : <Play data-icon="inline-start" />}
              {autonomousEnabled ? "Pause" : "Resume"}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">{nextRunText}</p>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => runAgentManually("sidebar") } disabled={loadingAgent}>
              <Play data-icon="inline-start" />
              {loadingAgent ? "Running..." : "Run Now"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={selectedActionIds.length === 0}
              onClick={() => applySelectedActions()}
            >
              Apply Selected
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card size="sm" className="mb-3 border-border/70 bg-panel/85">
        <CardHeader>
          <CardTitle className="text-xs">Proposed Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {pendingActions.length === 0 ? (
            <p className="text-xs text-muted-foreground">No pending actions from latest run.</p>
          ) : (
            <div className="space-y-2">
              {pendingActions.map((action) => {
                const selected = selectedActionIds.includes(action.id);
                return (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() => toggleActionSelection(action.id)}
                    className={cn(
                      "w-full rounded-md border p-2 text-left transition-colors",
                      selected ? "border-primary bg-primary/5" : "border-border/70 bg-surface/50 hover:bg-surface",
                    )}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="text-xs font-medium">{action.title}</p>
                      <Badge variant={action.safetyClass === "dangerous" ? "destructive" : "secondary"}>
                        {action.safetyClass === "dangerous" ? (
                          <ShieldAlert data-icon="inline-start" />
                        ) : (
                          <ShieldCheck data-icon="inline-start" />
                        )}
                        {action.safetyClass}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{action.detail}</p>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card size="sm" className="min-h-0 flex-1 border-border/70 bg-panel/85">
        <CardHeader>
          <CardTitle className="text-xs">Run Timeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 overflow-y-auto">
          {agentEvents.map((event) => (
            <div key={event.id} className="rounded-md border border-border/70 bg-surface/60 p-2">
              <div className="mb-1 flex items-center justify-between">
                <Badge variant="outline" className="capitalize">
                  {event.type}
                </Badge>
                <span className="text-[10px] text-muted-foreground">{formatIsoTime(event.time)}</span>
              </div>
              <p className="text-xs">{event.text}</p>
            </div>
          ))}

          {snapshots[0] ? (
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => undoSnapshot(snapshots[0].id)}
            >
              <History data-icon="inline-start" />
              Undo Last Applied Batch
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </aside>
  );
}
