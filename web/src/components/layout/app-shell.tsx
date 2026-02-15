"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { AgentRail } from "@/components/agent/agent-rail";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { OfflineSyncListener } from "@/components/layout/offline-sync-listener";
import { PwaRegister } from "@/components/layout/pwa-register";
import { Topbar } from "@/components/layout/topbar";
import type { HouraState } from "@/lib/schemas/types";
import { initializeClientTelemetry, useAppStore } from "@/lib/store/app-store";

export function AppShell({
  children,
  initialState,
}: {
  children: ReactNode;
  initialState: HouraState;
}) {
  const hydrateBootstrap = useAppStore((state) => state.hydrateBootstrap);
  const hydrateOfflineQueue = useAppStore((state) => state.hydrateOfflineQueue);
  const bootstrapped = useAppStore((state) => state.bootstrapped);
  const bootstrapError = useAppStore((state) => state.bootstrapError);

  useEffect(() => {
    initializeClientTelemetry();
    void hydrateOfflineQueue();
  }, [hydrateOfflineQueue]);

  useEffect(() => {
    if (!bootstrapped) {
      hydrateBootstrap(initialState);
    }
  }, [bootstrapped, hydrateBootstrap, initialState]);

  return (
    <div className="mx-auto flex h-screen w-full min-w-[1080px] max-w-[1720px] gap-3 p-3">
      <PwaRegister />
      <OfflineSyncListener />
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="glass-panel min-h-0 flex-1 overflow-auto rounded-2xl border border-border/70 bg-white/88 p-4">
          {bootstrapped ? (
            bootstrapError ? (
              <div className="flex h-full items-center justify-center">
                <div className="max-w-lg rounded-xl border border-border/70 bg-surface/70 p-4 text-sm">
                  <p className="font-semibold">Workspace Load Error</p>
                  <p className="mt-1 text-xs text-muted-foreground">{bootstrapError}</p>
                </div>
              </div>
            ) : (
              children
            )
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Loading student workspace...
            </div>
          )}
        </main>
      </div>
      <AgentRail />
    </div>
  );
}
