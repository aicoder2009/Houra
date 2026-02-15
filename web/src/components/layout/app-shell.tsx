"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { AgentRail } from "@/components/agent/agent-rail";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { OfflineSyncListener } from "@/components/layout/offline-sync-listener";
import { PwaRegister } from "@/components/layout/pwa-register";
import { Topbar } from "@/components/layout/topbar";
import { initPostHog } from "@/lib/posthog/client";

export function AppShell({ children }: { children: ReactNode }) {
  useEffect(() => {
    initPostHog();
  }, []);

  return (
    <div className="mx-auto flex h-screen w-full min-w-[1080px] max-w-[1720px] gap-3 p-3">
      <PwaRegister />
      <OfflineSyncListener />
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="glass-panel min-h-0 flex-1 overflow-auto rounded-2xl border border-border/70 bg-white/88 p-4">
          {children}
        </main>
      </div>
      <AgentRail />
    </div>
  );
}
