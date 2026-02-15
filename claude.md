# CLAUDE.md

## Product Context
Houra v2 is a student-first volunteer/service-hour tracking app with an autonomous right-rail Agent.

Primary user: high-school students logging service hours for clubs/schools (for example NHS) and generating submission-ready exports.

Core product promise:
- Track service entries quickly.
- Stay submission-ready with verification workflows.
- Handle offline usage and sync recovery.
- Let an AI agent propose and apply safe operational cleanups.

## Current MVP Scope (Implemented)
- Dashboard (hours, pending review, unsynced state, goal risk).
- Organizations workspace (goals, opportunities, activity).
- Logs (manual entry, bulk verify/reject, CSV/XLSX import).
- Reports (preset-based CSV/PDF export, share link management).
- Calendar timeline.
- Sync Center (queue state + conflict resolution).
- Audit Trail (filter + CSV export).
- Settings (agent model/autonomy toggles).
- Agent rail (run now, proposed actions, approval, apply, undo).

## Architecture Snapshot
- Frontend: Next.js 16 App Router + React 19 + TypeScript + shadcn UI.
- Auth: Clerk (student role + approval gate).
- Data model: central types in `web/src/lib/schemas/types.ts`.
- Runtime state:
  - Client store: Zustand persisted state.
  - Server runtime: in-memory DB seeded by `createSeedState`.
- Offline: PWA shell + IndexedDB queue + reconnect listener.
- Agent runtime: OpenAI Responses API with guardrails and fallback action generation.
- Storage: Supabase signed URLs when env is configured, otherwise mock URLs.
- Observability: PostHog (optional via env keys).

## Important Reality About Data
This MVP currently operates mostly on seeded/in-memory runtime data (not fully persisted relational reads/writes yet).

- Seed/state source: `web/src/lib/schemas/seed.ts`
- Server state container: `web/src/lib/server/runtime-db.ts`
- Supabase schema baseline exists at:
  - `web/supabase/migrations/20260215_000001_houra_v2_init.sql`

Treat persistence work as an incremental transition from runtime seed state to Supabase-backed flows.

## Agent Safety Model
Safety classes are determined in `web/src/lib/agent/guardrails.ts`.

Dangerous action kinds:
- `archive_record`
- `share_link_change`
- `export_generation`
- `bulk_status_transition`

Rules:
- Dangerous actions require explicit approval.
- Scheduled route (`/api/agent/runs/scheduled`) auto-applies safe actions only.
- All run/propose/apply/undo activity should remain audit-visible.

## Auth and Access Rules
- Student-only access.
- Approval gate uses Clerk `publicMetadata.isApproved`.
- In development, missing `isApproved` defaults to approved.
- Middleware and auth checks:
  - `web/src/proxy.ts`
  - `web/src/lib/clerk/claims.ts`
  - `web/src/lib/clerk/auth-service.ts`

## API Surface
- `POST /api/agent/runs`
- `POST /api/agent/runs/scheduled`
- `POST /api/agent/actions/apply`
- `POST /api/snapshots/:id/undo`
- `POST /api/imports`
- `POST /api/files/presign-upload`
- `POST /api/files/presign-download`
- `POST /api/sync/resolve-conflict`
- `GET /api/audit-events`
- `POST /api/reports/export`

## Local Development
From repo root:
- `npm run dev`
- `npm run lint`
- `npm run build`

Required env (`web/.env.local`):
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- Clerk redirect URL variables used in `web/README.md`

Optional env:
- Supabase (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`)
- OpenAI (`OPENAI_API_KEY`)
- Agent cron (`AGENT_CRON_SECRET`)
- PostHog (`NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`, `POSTHOG_PERSONAL_API_KEY`)

## Coding Guidance
When adding features:
- Reuse shared domain types from `web/src/lib/schemas/types.ts`.
- Keep agent mutations aligned with guardrails and approval flow.
- Record meaningful audit events for state-changing operations.
- Preserve student/approval authorization checks for all protected APIs.
- Keep offline/sync behavior coherent (queue status + conflict handling).
- Favor small, composable additions over broad rewrites.

## Key Files to Read First
- `README.md`
- `web/README.md`
- `web/src/lib/schemas/types.ts`
- `web/src/lib/schemas/seed.ts`
- `web/src/lib/store/app-store.ts`
- `web/src/lib/agent/agent-service.ts`
- `web/src/lib/agent/openai-runtime.ts`
- `web/src/lib/server/runtime-db.ts`
- `web/src/proxy.ts`
