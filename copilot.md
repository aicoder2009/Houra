# COPILOT.md

## What You Are Building
Houra v2 is a student volunteer-hour tracking app with a built-in autonomous operations Agent.

The app helps students:
- Log service hours quickly.
- Verify/clean records for submission.
- Import historical logs.
- Export reports as CSV/PDF.
- Manage share links.
- Recover from offline/sync conflicts.

## Product and UX Shape
Main app areas:
- Dashboard
- Organizations
- Logs
- Reports
- Calendar
- Sync
- Audit
- Settings
- Agent rail (right side)

The Agent is visible and actionable in the main shell, not a hidden backend-only workflow.

## Technical Baseline
- Next.js 16 App Router.
- React 19 + TypeScript.
- Zustand client store.
- Clerk auth + waitlist/approval model.
- Runtime in-memory DB for server-side state operations.
- Supabase migration/schema and optional storage integration.
- OpenAI Responses API for agent proposals.

## Non-Negotiables
- Keep auth student-only and approval-aware.
- Do not bypass dangerous-action approval checks.
- Maintain audit trail coverage for state-changing actions.
- Reuse shared types in `web/src/lib/schemas/types.ts`.
- Preserve existing API contracts unless explicitly changing them.

## Agent Guardrails
Dangerous action kinds (approval required):
- `archive_record`
- `share_link_change`
- `export_generation`
- `bulk_status_transition`

Safe actions can be auto-applied during scheduled runs.

## Data and Persistence Reality
Most current runtime behavior is seeded/in-memory.

Important files:
- Seed source: `web/src/lib/schemas/seed.ts`
- Runtime DB: `web/src/lib/server/runtime-db.ts`
- Supabase baseline schema: `web/supabase/migrations/20260215_000001_houra_v2_init.sql`

When writing code, treat persistence expansion as incremental and avoid assumptions that every flow is already fully DB-backed.

## Helpful Commands
From repo root:
- `npm run dev`
- `npm run lint`
- `npm run build`

## Env Expectations
Required:
- Clerk keys in `web/.env.local`

Optional but important for complete behavior:
- `OPENAI_API_KEY`
- Supabase keys
- `AGENT_CRON_SECRET`
- PostHog keys
