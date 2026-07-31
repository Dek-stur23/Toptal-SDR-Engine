-- ============================================================
-- activity_events — lightweight usage log for client-side tools.
-- Run after 009_accounts_default_ese.sql.
--
-- Most tools already leave a trace in their own tables (goal_logs,
-- meetings, opportunities, ai_usage, …), so "who used what this week"
-- can be derived from those. The ZoomInfo → Lusha CSV workflow is the
-- exception: it runs entirely in the browser and writes nothing, so it
-- was invisible to usage reporting. This table is the minimal fix —
-- one row per meaningful action, carrying only the tool name, the
-- action, and a timestamp. No prospect data is ever stored here.
--
-- Purely additive: new table + its RLS policy. Touches nothing else.
-- ============================================================

create table if not exists activity_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tool        text not null,   -- e.g. 'ZoomInfo → Lusha'
  action      text not null,   -- e.g. 'prep', 'cleanup', 'generate-emails'
  created_at  timestamptz not null default now()
);

create index if not exists activity_events_user_time_idx
  on activity_events (user_id, created_at);
create index if not exists activity_events_time_idx
  on activity_events (created_at);

alter table activity_events enable row level security;

-- Each user inserts + reads only their own events. The user_id default
-- (auth.uid()) stamps the caller automatically, so the client never
-- sends it. Admin/service-role reads for cross-user reporting bypass
-- RLS, exactly like the rest of the app's admin surfaces.
create policy "activity_events: own"
  on activity_events for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
