"use client";

import { useEffect, useState } from "react";
import { Bell, Wrench, Bot, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SectionHeader } from "@/components/layout/section-header";
import { useAppStore } from "@/lib/store/app-store";
import type { AuthContext } from "@/lib/schemas/types";

export default function SettingsPage() {
  const selectedModel = useAppStore((state) => state.selectedModel);
  const modelOptions = useAppStore((state) => state.modelOptions);
  const autonomousEnabled = useAppStore((state) => state.autonomousEnabled);
  const autoApplySafe = useAppStore((state) => state.autoApplySafe);
  const approvalForDangerous = useAppStore((state) => state.approvalForDangerous);

  const setSelectedModel = useAppStore((state) => state.setSelectedModel);
  const setAutonomousEnabled = useAppStore((state) => state.setAutonomousEnabled);
  const setAutoApplySafe = useAppStore((state) => state.setAutoApplySafe);
  const setApprovalForDangerous = useAppStore((state) => state.setApprovalForDangerous);
  const [authContext, setAuthContext] = useState<AuthContext | null>(null);
  const [openAiConfigured, setOpenAiConfigured] = useState<boolean | null>(null);
  const [assistantConfigured, setAssistantConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/me")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (payload?.auth) {
          setAuthContext(payload.auth as AuthContext);
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    fetch("/api/agent/config")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (!payload) return;
        setOpenAiConfigured(Boolean(payload.openAiConfigured));
        setAssistantConfigured(Boolean(payload.assistantConfigured));
      })
      .catch(() => undefined);
  }, []);

  return (
    <div>
      <SectionHeader
        title="Settings"
        subtitle="Agent defaults, rollout controls, and runtime diagnostics."
      />

      <div className="grid gap-3 xl:grid-cols-2">
        <Card className="border-border/70 bg-panel/85">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Bot className="size-4" />
              Agent Runtime
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="space-y-1">
              <p className="text-[11px] font-medium text-muted-foreground">Default Model</p>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {modelOptions.map((option) => (
                    <SelectItem key={option.id} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 rounded-md border border-border/70 bg-surface/60 p-3">
              <label className="flex items-center justify-between">
                <span>Autonomous schedule enabled</span>
                <input
                  type="checkbox"
                  checked={autonomousEnabled}
                  onChange={(event) => setAutonomousEnabled(event.target.checked)}
                />
              </label>
              <label className="flex items-center justify-between">
                <span>Auto-apply safe action classes</span>
                <input
                  type="checkbox"
                  checked={autoApplySafe}
                  onChange={(event) => setAutoApplySafe(event.target.checked)}
                />
              </label>
              <label className="flex items-center justify-between">
                <span>Require approval for dangerous classes</span>
                <input
                  type="checkbox"
                  checked={approvalForDangerous}
                  onChange={(event) => setApprovalForDangerous(event.target.checked)}
                />
              </label>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-panel/85">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <ShieldCheck className="size-4" />
              Runtime Diagnostics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="rounded-md border border-border/70 bg-surface/60 p-3">
              <p className="mb-1 font-medium">Environment</p>
              <p className="text-[11px] text-muted-foreground">Next.js 16 App Router · Clerk auth · Supabase adapter · Vercel cron-ready routes</p>
            </div>
            <div className="rounded-md border border-border/70 bg-surface/60 p-3">
              <p className="mb-1 font-medium">Auth Diagnostics</p>
              {authContext ? (
                <p className="text-[11px] text-muted-foreground">
                  role={authContext.role} · approved={String(authContext.isApproved)} · session=
                  {authContext.sessionId ?? "none"}
                </p>
              ) : (
                <p className="text-[11px] text-muted-foreground">Loading auth context…</p>
              )}
            </div>
            <div className="rounded-md border border-border/70 bg-surface/60 p-3">
              <p className="mb-1 font-medium">Agent Provider</p>
              {openAiConfigured === null ? (
                <p className="text-[11px] text-muted-foreground">Checking OpenAI config…</p>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  OpenAI API key: {openAiConfigured ? "configured" : "missing"} · Assistant ID:{" "}
                  {assistantConfigured ? "set" : "not set"}
                </p>
              )}
            </div>
            <div className="rounded-md border border-border/70 bg-surface/60 p-3">
              <p className="mb-1 font-medium">Feature Rollout</p>
              <p className="text-[11px] text-muted-foreground">PostHog feature flags and in-app announcement hooks are initialized when keys exist.</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline">
                <Bell data-icon="inline-start" />
                Reminder Preferences
              </Button>
              <Button size="sm" variant="outline">
                <Wrench data-icon="inline-start" />
                Diagnostics Dump
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
