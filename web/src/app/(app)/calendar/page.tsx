"use client";

import { useMemo } from "react";
import { CalendarRange } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/layout/section-header";
import { formatIsoDateTime } from "@/lib/format";
import { useAppStore } from "@/lib/store/app-store";

type CalendarItem = {
  id: string;
  date: string;
  title: string;
  type: "entry" | "goal" | "opportunity";
};

export default function CalendarPage() {
  const entries = useAppStore((state) => state.entries);
  const goals = useAppStore((state) => state.goals);
  const opportunities = useAppStore((state) => state.opportunities);

  const items = useMemo<CalendarItem[]>(() => {
    const mapped: CalendarItem[] = [
      ...entries.map((entry) => ({
        id: entry.id,
        date: entry.startAt,
        title: `${entry.activityName} (${(entry.durationMinutes / 60).toFixed(1)}h)`,
        type: "entry" as const,
      })),
      ...goals.map((goal) => ({
        id: goal.id,
        date: goal.dueDate,
        title: `Goal Due: ${goal.title}`,
        type: "goal" as const,
      })),
      ...opportunities.map((item) => ({
        id: item.id,
        date: item.date,
        title: `Opportunity: ${item.title}`,
        type: "opportunity" as const,
      })),
    ];

    return mapped.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [entries, goals, opportunities]);

  return (
    <div>
      <SectionHeader
        title="Calendar"
        subtitle="Unified schedule for service entries, opportunities, and goal deadlines."
      />

      <Card className="border-border/70 bg-panel/85">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <CalendarRange className="size-4" />
            Timeline
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-md border border-border/70 bg-surface/60 px-3 py-2 text-xs">
              <div>
                <p className="font-medium">{item.title}</p>
                <p className="text-[11px] text-muted-foreground">{formatIsoDateTime(item.date)}</p>
              </div>
              <Badge variant="outline" className="capitalize">
                {item.type}
              </Badge>
            </div>
          ))}
          {items.length === 0 ? <p className="text-xs text-muted-foreground">No items scheduled yet.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
