# Houra Web

Next.js 16 App Router implementation of Houra v2.

## Scripts

```bash
npm run dev
npm run lint
npm run build
npm run start
```

## Required Env

Create `.env.local` with at least:

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...
CLERK_SECRET_KEY=...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/dashboard
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/dashboard
```

Optional:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
OPENAI_API_KEY=...
AGENT_CRON_SECRET=...
NEXT_PUBLIC_POSTHOG_KEY=...
NEXT_PUBLIC_POSTHOG_HOST=...
POSTHOG_PERSONAL_API_KEY=...
```

## Supabase

Base schema migration is in:

- `/Users/karthickarun/Documents/Github Repos/Houra/web/supabase/migrations/20260215_000001_houra_v2_init.sql`
