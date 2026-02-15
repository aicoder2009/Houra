import OpenAI from "openai";
import { nowIso } from "@/lib/schemas/seed";
import type {
  AgentAction,
  AgentActionKind,
  AgentRun,
  EntityType,
  HouraState,
} from "@/lib/schemas/types";
import { getSafetyClass } from "@/lib/agent/guardrails";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const assistantId = process.env.OPENAI_ASSISTANT_ID?.trim() || null;

export async function createAgentRun(input: {
  studentId: string;
  objective: string;
  contextScope: string;
  model: string;
  autonomous: boolean;
}): Promise<AgentRun> {
  return {
    id: crypto.randomUUID(),
    studentId: input.studentId,
    model: input.model,
    objective: input.objective,
    contextScope: input.contextScope,
    status: "Proposing",
    autonomous: input.autonomous,
    createdAt: nowIso(),
  };
}

export async function generateAgentActions(input: {
  run: AgentRun;
  state: HouraState;
}): Promise<AgentAction[]> {
  const draft = buildFallbackActions(input.run, input.state);

  if (!openai) {
    return draft;
  }

  try {
    const raw = assistantId
      ? await generateWithAssistant({
          assistantId,
          model: input.run.model,
          objective: input.run.objective,
          contextScope: input.run.contextScope,
          state: input.state,
        })
      : await generateWithResponses({
          model: input.run.model,
          objective: input.run.objective,
          contextScope: input.run.contextScope,
          state: input.state,
        });

    if (!raw) {
      return draft;
    }

    const parsedJson = JSON.parse(raw) as
      | Array<unknown>
      | {
          actions?: Array<unknown>;
        };

    const items = Array.isArray(parsedJson)
      ? parsedJson
      : Array.isArray(parsedJson.actions)
        ? parsedJson.actions
        : [];

    const parsed = items as Array<{
      title: string;
      detail: string;
      actionKind: AgentActionKind;
      targetEntity: EntityType;
      targetId: string;
      diffJson: string;
    }>;

    if (!Array.isArray(parsed) || parsed.length === 0) {
      return draft;
    }

    return parsed.slice(0, 12).map((item) => ({
      id: crypto.randomUUID(),
      runId: input.run.id,
      actionType: "propose",
      actionKind: item.actionKind,
      safetyClass: getSafetyClass(item.actionKind),
      targetEntity: item.targetEntity,
      targetId: item.targetId,
      title: item.title,
      detail: item.detail,
      diffJson: item.diffJson,
      approved: false,
    }));
  } catch {
    return draft;
  }
}

async function generateWithResponses(input: {
  model: string;
  objective: string;
  contextScope: string;
  state: HouraState;
}): Promise<string> {
  if (!openai) return "";

  const completion = await openai.responses.create({
    model: input.model,
    input: [
      {
        role: "system",
        content:
          "You are an autonomous operations agent for a student service-hours app. Return ONLY valid JSON. Prefer an object like {\"actions\":[...]} for compatibility.",
      },
      {
        role: "user",
        content: JSON.stringify({
          objective: input.objective,
          contextScope: input.contextScope,
          entries: input.state.entries.slice(0, 25),
          syncQueue: input.state.syncQueue.slice(0, 25),
          shareLinks: input.state.shareLinks.slice(0, 10),
        }),
      },
    ],
    max_output_tokens: 1200,
  });

  return completion.output_text?.trim() ?? "";
}

async function generateWithAssistant(input: {
  assistantId: string;
  model: string;
  objective: string;
  contextScope: string;
  state: HouraState;
}): Promise<string> {
  if (!openai) return "";

  const thread = await openai.beta.threads.create();

  const userPayload = {
    objective: input.objective,
    contextScope: input.contextScope,
    entries: input.state.entries.slice(0, 25),
    syncQueue: input.state.syncQueue.slice(0, 25),
    shareLinks: input.state.shareLinks.slice(0, 10),
  };

  await openai.beta.threads.messages.create(thread.id, {
    role: "user",
    content: JSON.stringify(userPayload),
  });

  const run = await openai.beta.threads.runs.createAndPoll(thread.id, {
    assistant_id: input.assistantId,
    model: input.model,
    instructions:
      "You are an autonomous agent for a student service-hours app. Return ONLY valid JSON. " +
      "Return a JSON object with shape: {\"actions\":[{title,detail,actionKind,targetEntity,targetId,diffJson}]}. " +
      "Do not wrap in markdown. If there are no actions, return {\"actions\":[]}. " +
      "Allowed actionKind values: status_normalization, dedup_metadata, sync_retry, archive_record, share_link_change, export_generation, bulk_status_transition.",
    response_format: { type: "json_object" },
  });

  if (run.status !== "completed") {
    return "";
  }

  const messages = await openai.beta.threads.messages.list(thread.id, { limit: 10 });
  const latestAssistant = messages.data.find((message) => message.role === "assistant");
  if (!latestAssistant) return "";

  const textParts = latestAssistant.content
    .map((part) => (part.type === "text" ? part.text.value : ""))
    .filter(Boolean);

  return textParts.join("\n").trim();
}

function buildFallbackActions(run: AgentRun, state: HouraState): AgentAction[] {
  const actions: AgentAction[] = [];

  const pendingEntry = state.entries.find((entry) => entry.status === "Pending Review");
  if (pendingEntry) {
    actions.push({
      id: crypto.randomUUID(),
      runId: run.id,
      actionType: "propose",
      actionKind: "status_normalization",
      safetyClass: getSafetyClass("status_normalization"),
      targetEntity: "serviceEntry",
      targetId: pendingEntry.id,
      title: `Verify ${pendingEntry.activityName}`,
      detail: "Entry has plausible duration and notes. Promote to Verified.",
      diffJson: '{"status":"Pending Review->Verified"}',
      approved: false,
    });
  }

  const queuedSync = state.syncQueue.find((item) => item.status !== "Synced");
  if (queuedSync) {
    actions.push({
      id: crypto.randomUUID(),
      runId: run.id,
      actionType: "propose",
      actionKind: "sync_retry",
      safetyClass: getSafetyClass("sync_retry"),
      targetEntity: "syncQueueItem",
      targetId: queuedSync.id,
      title: "Retry sync queue",
      detail: "Unsynced mutations detected. Trigger retry to reduce queue age.",
      diffJson: '{"status":"Queued->Uploading"}',
      approved: false,
    });
  }

  const expiredLink = state.shareLinks.find(
    (link) => !link.revokedAt && new Date(link.expiresAt).getTime() < Date.now(),
  );
  if (expiredLink) {
    actions.push({
      id: crypto.randomUUID(),
      runId: run.id,
      actionType: "propose",
      actionKind: "share_link_change",
      safetyClass: getSafetyClass("share_link_change"),
      targetEntity: "shareLink",
      targetId: expiredLink.id,
      title: "Revoke expired share link",
      detail: "Expired links should be revoked for safety.",
      diffJson: '{"revokedAt":"set"}',
      approved: false,
    });
  }

  if (actions.length === 0) {
    actions.push({
      id: crypto.randomUUID(),
      runId: run.id,
      actionType: "propose",
      actionKind: "dedup_metadata",
      safetyClass: getSafetyClass("dedup_metadata"),
      targetEntity: "organization",
      targetId: state.organizations[0]?.id ?? crypto.randomUUID(),
      title: "Normalize organization metadata",
      detail: "No urgent actions found. Applying metadata consistency pass.",
      diffJson: '{"name":"trim_whitespace"}',
      approved: false,
    });
  }

  return actions;
}
