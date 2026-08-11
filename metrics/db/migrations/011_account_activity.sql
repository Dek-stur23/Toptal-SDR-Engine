-- ============================================================
-- Per-account call activity (cadence tracker). Run after
-- 010_activity_events.sql.
--
-- Backs the Accounts → Activity view. A rep uploads a raw dialer
-- export (one row per call); the importer aggregates it to this
-- grain and the view rolls it up per account over a date range.
--
-- Grain: one row per (user, account, prospect, day). That lets the
-- view compute all four metrics correctly over any range:
--   dials           = sum(dials)
--   connects        = sum(connects)
--   meetings booked = sum(meetings_booked)
--   new prospects   = count(distinct prospect_key)
--
-- Deliberately standalone: it does NOT feed goal_logs, meetings, or
-- pacing. It's a separate cadence lens, not a source of truth for
-- goals. Purely additive — new table + its RLS only.
-- ============================================================

create table if not exists account_activity (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  account_id      uuid not null references accounts(id) on delete cascade,
  -- Normalized prospect identity (email, else phone digits, else
  -- lower-cased name) so distinct prospects can be counted per range.
  prospect_key    text not null,
  -- Human-readable name for reference/debugging. Not used for counts.
  prospect_name   text not null default '',
  activity_date   date not null,
  dials           integer not null default 0 check (dials >= 0),
  connects        integer not null default 0 check (connects >= 0),
  meetings_booked integer not null default 0 check (meetings_booked >= 0),
  created_at      timestamptz not null default now(),
  unique (user_id, account_id, prospect_key, activity_date)
);

create index if not exists account_activity_user_date_idx
  on account_activity (user_id, activity_date);
create index if not exists account_activity_account_idx
  on account_activity (account_id);

alter table account_activity enable row level security;
create policy "account_activity: own"
  on account_activity for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
