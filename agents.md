# AGENTS.md

## Project Context
You are working on Houra v2.

Houra is a Next.js web app for student service-hour tracking with an autonomous right-rail Agent that proposes operational actions and applies approved ones.

## Core Domain
Primary entities include:
- Student
- Organization
- Goal
- Opportunity
- ServiceEntry
- ShareLink
- SyncQueueItem
- SyncConflict
- AgentRun
- AgentAction
- StateSnapshot
- AuditEvent

Canonical types live in `web/src/lib/schemas/types.ts`.

## Current Product Scope
Implemented modules:
- Dashboard
- Organizations workspace
- Logs (bulk verify/reject + import)
- Reports (CSV/PDF export + share links)
- Calendar
- Sync Center
- Audit Trail
- Settings
- Agent rail (model/objective/run/apply/undo)

## Architecture Notes
- Client state: Zustand store in `web/src/lib/store/app-store.ts`.
- Server runtime state: in-memory DB in `web/src/lib/server/runtime-db.ts`.
- Seeded default data in `web/src/lib/schemas/seed.ts`.
- Auth/middleware via Clerk (`web/src/proxy.ts`).
- Agent runtime (`web/src/lib/agent/*`) with OpenAI fallback behavior.
- Supabase schema exists, but many flows remain runtime-state based.

## Safety and Authorization Constraints
- Student-only access.
- Approval gate via Clerk metadata (`isApproved`).
- Dangerous agent actions require explicit approval.
- Keep audit visibility for mutations.

Dangerous action kinds:
- `archive_record`
- `share_link_change`
- `export_generation`
- `bulk_status_transition`

## API Endpoints in Use
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

## Working Expectations for Agents
- Prefer small focused changes.
- Keep feature behavior aligned with existing UX and terminology.
- Reuse existing utility and schema layers before creating new abstractions.
- Avoid introducing persistence assumptions that conflict with current in-memory runtime patterns.
- Validate with lint/build when making non-trivial changes.

## Run Commands
From repo root:
- `npm run dev`
- `npm run lint`
- `npm run build`
