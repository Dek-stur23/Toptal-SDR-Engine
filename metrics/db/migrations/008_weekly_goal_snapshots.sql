-- ============================================================
-- weekly_goal_snapshots. Run after 007_meetings_salesloft_url.sql.
--
-- Freezes the weekly goals + benchmarks that were live for a
-- specific past week so mid-quarter edits to quarterly_goals don't
-- retroactively re-color the archive or the pacing chart's goal
-- line for weeks that already ended.
--
-- Populated lazily by the app: when the user saves updated
-- quarterly goals, the app first snapshots any past weeks in the
-- current quarter that don't already have a row here, using the
-- OLD (pre-edit) goals.
-- ============================================================

create table if not exists weekly_goal_snapshots (
  id                                  uuid primary key default gen_random_uuid(),
  user_id                             uuid not null default auth.uid() references auth.users(id) on delete cascade,
  week_start                          date not null,
  weekly_dials_goal                   int  not null default 0,
  weekly_dials_benchmark              int  not null default 0,
  weekly_prospects_goal               int  not null default 0,
  weekly_prospects_benchmark          int  not null default 0,
  weekly_meetings_booked_goal         int  not null default 0,
  weekly_meetings_booked_benchmark    int  not null default 0,
  weekly_meetings_held_goal           int  not null default 0,
  weekly_meetings_held_benchmark      int  not null default 0,
  snapshot_at                         timestamptz not null default now(),
  unique (user_id, week_start)
);

create index if not exists weekly_goal_snapshots_user_idx
  on weekly_goal_snapshots (user_id, week_start desc);

alter table weekly_goal_snapshots enable row level security;
create policy "weekly_goal_snapshots: own"
  on weekly_goal_snapshots for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
