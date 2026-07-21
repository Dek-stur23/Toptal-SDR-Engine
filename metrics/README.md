# SDR Metrics

Standalone multi-user version of the Goals & Metrics + Meetings Tracker
tools from the SDR Launchpad. Next.js 14 (App Router) on top of Supabase
(Postgres + Auth + Storage), deployable to Vercel.

## Local setup

1. **Create a Supabase project** at https://supabase.com. Pick the
   nearest region and a strong database password.

2. **Run the migrations, in order.** Open the Supabase SQL editor and
   run each file in `db/migrations/` sequentially:
   - `001_initial.sql` — tables, RLS policies, invite-gate + auto-
     profile triggers.
   - `002_admin_policies.sql` — lets admins manage the invite
     allowlist from the in-app `/admin/invites` page.

3. **Create the storage bucket** for meeting screenshots. In the
   Supabase dashboard: Storage → New bucket → name `meeting-images`,
   private. Then add the two policies described at the bottom of
   `db/migrations/001_initial.sql`.

4. **Invite yourself.** In the SQL editor:
   ```sql
   insert into allowed_emails (email) values ('you@example.com');
   ```
   Then sign up through the app. After signing up, promote yourself to
   admin:
   ```sql
   update profiles set is_admin = true where id = (
     select id from auth.users where email = 'you@example.com'
   );
   ```

5. **Configure env vars.** Copy `.env.example` to `.env.local` and fill
   in Supabase URL, anon key, service role key, and (optionally) the
   Anthropic key for meeting-screenshot autofill.

6. **Install and run.**
   ```bash
   npm install
   npm run dev
   ```
   The dev server starts on http://localhost:3001 to avoid conflicting
   with the main SDR Launchpad on 3000.

## Deployment

Deploy to Vercel. Set the same env vars in the project settings, then
point the Supabase project's Auth redirect URLs at the deployed origin.

## Architecture

- **Auth:** Supabase Auth with email + password. Signup is gated by the
  `allowed_emails` table via a trigger on `auth.users`.
- **Data isolation:** Every user-owned table has a `user_id uuid`
  column and an RLS policy that reduces to `user_id = auth.uid()`, so
  users only ever see their own data.
- **AI:** Autofill uses a shared Anthropic key. Per-user monthly spend
  is capped via `ai_usage` + the `/api/generate` route middleware
  (default cap in `AI_MONTHLY_CAP_CENTS`, $50).
- **Images:** Meeting screenshots live in the private `meeting-images`
  bucket, keyed as `{user_id}/meetings/{meeting_id}.{ext}`.
