# Houra v2

Houra is a **Next.js 16 web app** for student volunteer-hour tracking with a right-rail **autonomous Agent**.

## Stack

- Frontend: Next.js App Router + React 19 + shadcn UI
- Auth: Clerk (Apple / Google / Email)
- Data: Supabase-ready schema + storage abstraction
- Agent: OpenAI Responses API with safe/dangerous guardrails
- Offline-first: PWA shell + IndexedDB queue + reconnect sync

## Repo Layout

- Web app: `/Users/karthickarun/Documents/Github Repos/Houra/web`
- Root scripts proxy to `web/`

## Local Run

1. Configure Clerk keys in `/Users/karthickarun/Documents/Github Repos/Houra/web/.env.local`.
2. Start dev server:

```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000).

## Build + Lint

```bash
npm run lint
npm run build
```

## Implemented MVP Modules

- Dashboard
- Organizations workspace
- Logs + bulk verify/reject + CSV/XLSX import
- Reports + CSV/PDF export + share-link controls
- Calendar
- Sync center + conflict resolution
- Audit trail + CSV export
- Settings
- Autonomous Agent rail with model selection, run/apply/undo

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

## Notes

- Production approval is controlled by Clerk `publicMetadata.isApproved`.
- In development, missing approval metadata auto-falls back to approved so you can test full app flow after login.
