# SDR Sidekick — Replication Guide

Everything needed to stand up your own copy of **SDR Sidekick** from
scratch. Hand this file (and the rest of this directory) to a fresh
Claude Code session, or follow it by hand. This directory is fully
self-contained — it does **not** depend on the parent `Toptal-SDR-Engine`
repo.

> **What "the entire codebase and data" means here.** The *code* is every
> file in this directory. The *data model* (schema, tables, row-level
> security, triggers) is the set of SQL files in `db/migrations/`, applied
> in order. Actual user rows (meetings, goals, etc.) are **not** included
> and should not be copied — they are private user data living in the
> original Supabase project. A replica starts with an empty database and
> fills as people use it. If you specifically want the production
> *structure* as a single dump, see "Cloning an exact schema" at the end.

---

## 1. What it is

A standalone, multi-user Next.js app for SDR goal tracking + meeting
management, on top of Supabase (Postgres + Auth + Storage), deployable to
Vercel. Signup is invite-gated; every user only sees their own data via
row-level security; admins get an invite manager and a platform-wide
usage dashboard.

Primary surfaces: **Goals & Metrics**, **Meetings Tracker**, **Accounts**,
the **ZoomInfo → Lusha CSV** tool, and (admins only) **Usage** +
**Invites**.

## 2. Stack & versions

- Next.js 14 (App Router) + React 18 + TypeScript 5
- Tailwind CSS 3 + `tailwindcss-animate` / `@tailwindcss/typography`
- Supabase: `@supabase/ssr` + `@supabase/supabase-js`
- `@anthropic-ai/sdk` (server-side only, for meeting-screenshot autofill)
- `lucide-react` icons, `clsx`

Exact versions are pinned in `package.json` / `package-lock.json` — install
from the lockfile for a reproducible tree.

## 3. Prerequisites

- Node 18.18+ (or 20+) and npm
- A Supabase account (free tier is fine)
- (Optional) An Anthropic API key — only needed for the meeting-modal
  "autofill from screenshot" feature. The app runs fine without it; that
  one button just won't work.

## 4. Setup, step by step

### 4.1 Install

```bash
npm install
```

### 4.2 Create a Supabase project

Create a project at <https://supabase.com>. Pick a region near your users
and set a strong database password.

### 4.3 Run the migrations — in order

Open the Supabase **SQL editor** and run each file in `db/migrations/`
**sequentially**. Order matters (later files depend on earlier ones):

| # | File | What it does |
|---|------|--------------|
| 001 | `001_initial.sql` | Core tables, RLS, invite-gate + auto-profile triggers |
| 002 | `002_admin_policies.sql` | Lets admins manage the invite allowlist in-app |
| 003 | `003_user_id_defaults.sql` | `user_id default auth.uid()` so app inserts pass RLS |
| 004 | `004_eses.sql` | Per-user ESE list backing meeting dropdowns |
| 005 | `005_opportunities.sql` | Opportunities + updates under held meetings |
| 006 | `006_ai_endpoints.sql` | Widens the ai_usage endpoint check |
| 007 | `007_meetings_salesloft_url.sql` | Optional salesloft_url on meetings |
| 008 | `008_weekly_goal_snapshots.sql` | Freezes past-week goals/benchmarks |
| 009 | `009_accounts_default_ese.sql` | Optional per-account default ESE |
| 010 | `010_activity_events.sql` | Usage log for tracking + the Usage dashboard |

> Every file is idempotent (`if not exists` / `set default`), **except**
> the `create policy` statements — Postgres has no `if not exists` for
> policies, so re-running a migration will error with *"policy already
> exists."* That error is harmless and just means the file already ran.

### 4.4 Create the storage bucket

For meeting screenshots. In the Supabase dashboard: **Storage → New
bucket**, name it `meeting-images`, **private**. Then add the two policies
described at the bottom of `db/migrations/001_initial.sql` (read-own /
write-own, keyed on the object path's first segment matching `auth.uid()`).
Objects are keyed `{user_id}/meetings/{meeting_id}.{ext}`.

### 4.5 Configure environment variables

Copy `.env.example` to `.env.local` and fill in:

```
NEXT_PUBLIC_SUPABASE_URL=...          # Supabase → Settings → API
NEXT_PUBLIC_SUPABASE_ANON_KEY=...     # Supabase → Settings → API
SUPABASE_SERVICE_ROLE_KEY=...         # server-only; bypasses RLS
ANTHROPIC_API_KEY=sk-ant-...          # optional (autofill only)
ANTHROPIC_MODEL=claude-sonnet-4-6     # or your preferred model
AI_MONTHLY_CAP_CENTS=5000             # per-user monthly AI cap ($50)
```

The service-role key must **never** reach the browser — it is only
imported by server code (`lib/supabase/service.ts`).

### 4.6 Invite yourself + become admin

In the Supabase SQL editor:

```sql
insert into allowed_emails (email) values ('you@yourcompany.com');
```

Then sign up through the app with that email. After signup, promote
yourself:

```sql
update profiles set is_admin = true where id = (
  select id from auth.users where email = 'you@yourcompany.com'
);
```

### 4.7 Run

```bash
npm run dev          # http://localhost:3001
```

## 5. Deploy (Vercel)

Import the repo into Vercel, set the same env vars in project settings,
and point the Supabase project's **Auth → URL Configuration** redirect
URLs at the deployed origin. `npm run build` must pass (it does today).

## 6. Architecture notes (so a rebuild stays faithful)

- **AI calls run server-side** through `app/api/generate/route.ts`, which
  meters spend into `ai_usage` and enforces `AI_MONTHLY_CAP_CENTS`.
- **Data isolation:** every user-owned table has `user_id uuid` + an RLS
  policy that reduces to `user_id = auth.uid()`. `003` gives those columns
  a `default auth.uid()` so the client can insert without sending an id.
- **Admin surfaces** (`/admin/*`) are gated in the server component by
  `getMyProfile(...).isAdmin` and, when they need to read across users
  (the Usage dashboard), use the **service-role** client which bypasses
  RLS. Never do cross-user reads from the browser.
- **Usage tracking:** `components/UsageTracker.tsx` (mounted in the app
  shell) logs one `activity_events` row per navigation; the ZoomInfo →
  Lusha tool logs its own actions. `/admin/activity` aggregates them.
- **The ZoomInfo → Lusha tool is otherwise client-side** — CSV processing
  never leaves the browser; only a tool/action/timestamp usage ping is
  sent.

## 7. Customize it for your company

Search-and-replace / review these before going live:

- **Branding:** "SDR Sidekick" (app shell title), page `<title>` in
  `app/layout.tsx`, the icon `app/icon.png.png`.
- **Terminology:** "ESE" (Enterprise Sales Executive) throughout Meetings
  + Accounts; the goal metric names in `lib/types.ts` / the Goals UI.
- **Integrations:** the ZoomInfo → Lusha → SalesLoft CSV column mappings
  live in `lib/lusha-cleanup/config.ts` and `components/LushaCsvPrep.tsx`
  — retune the header lists to your data providers.
- **AI model / cap:** `ANTHROPIC_MODEL`, `AI_MONTHLY_CAP_CENTS`, and the
  prompt in `lib/ai/prompts.ts`.
- **Port:** dev/start run on 3001 (`package.json`) to avoid colliding with
  the original parent app on 3000; change if you like.

## 8. Cloning an exact schema (optional)

If you want the production database *structure* (not the code, not the
rows) as one file instead of replaying migrations, run against the source
project:

```bash
# schema only, no data — safe, contains no user rows
pg_dump --schema-only --no-owner --no-privileges \
  "postgresql://postgres:<pw>@<host>:5432/postgres" > schema.sql
```

Then run `schema.sql` in your new project instead of the migration files.
The migrations are the source of truth, though — prefer §4.3 unless you
have a specific reason.

## 9. File map

```
app/
  (app)/                 authenticated routes (goals, meetings, accounts,
                         lusha-csv, settings, admin/activity, admin/invites)
  api/generate/route.ts  Anthropic proxy + per-user spend metering
  auth/                  Supabase auth callback + signout
  login, signup, forgot-password, reset-password
components/              all UI (AppShell, tools, tables, UsageTracker, …)
lib/
  supabase/              client / server / service (service = RLS bypass)
  data/                  one module per table (typed CRUD)
  lusha-cleanup/         pure ZoomInfo↔Lusha↔SalesLoft engine + nomenclature
  ai/prompts.ts          autofill system prompt
  usage.ts               route→tool labels + date-range presets
  types.ts               shared domain types
db/migrations/           001–010, run in order (see §4.3)
middleware.ts            session refresh + auth redirects
```
