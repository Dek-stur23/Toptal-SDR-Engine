-- ============================================================
-- SDR Metrics — initial schema
-- Postgres 15 (Supabase). Paste this whole file into Supabase's SQL
-- editor and run it once.
--
-- Design notes:
-- - Every user-owned table has user_id uuid references auth.users(id)
--   on delete cascade.
-- - Row-Level Security enabled on every table, with a policy that
--   reduces to "user_id = auth.uid()".
-- - Enum-ish values are stored as text with check constraints, not
--   Postgres enums (easier to evolve).
-- - `auth.users` is Supabase Auth's built-in table — we never touch
--   its schema directly, we just reference it.
-- ============================================================

-- Extensions --------------------------------------------------------
create extension if not exists "pgcrypto";  -- gen_random_uuid()

-- ============================================================
-- allowed_emails — invite gate
-- ============================================================
-- No public signup. The trigger below blocks any insert into
-- auth.users whose email isn't in this list. Add rows via the
-- Supabase dashboard, or through the /admin/invites page once
-- you're signed in as an admin.

create table if not exists allowed_emails (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique,
  added_by   uuid references auth.users(id),
  added_at   timestamptz not null default now()
);

alter table allowed_emails enable row level security;

-- Anyone (signed in or not) can read the list — no PII beyond the
-- email itself, and reading is what the signup trigger needs.
create policy "allowed_emails: read"
  on allowed_emails for select using (true);
-- No insert/update/delete policies — admins do that via the
-- Supabase dashboard or a server-side admin API using the
-- service-role key.

-- ============================================================
-- profiles — per-user app-level data
-- ============================================================
-- Auto-created on signup via the trigger below. `is_admin` is
-- toggled manually via the Supabase SQL editor for the first
-- admin, then via the in-app admin page for anyone else.

create table if not exists profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text,
  is_admin      boolean not null default false,
  onboarded_at  timestamptz,
  created_at    timestamptz not null default now()
);

alter table profiles enable row level security;
create policy "profiles: read own"   on profiles for select using (id = auth.uid());
create policy "profiles: update own" on profiles for update using (id = auth.uid());

-- ============================================================
-- accounts — per-user list of company names for tagging
-- ============================================================
create table if not exists accounts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null,
  is_archived  boolean not null default false,
  created_at   timestamptz not null default now()
);

create unique index if not exists accounts_user_name_lower_uk
  on accounts (user_id, lower(name));
create index if not exists accounts_user_idx on accounts (user_id);

alter table accounts enable row level security;
create policy "accounts: own"
  on accounts for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ============================================================
-- quarterly_goals — one row per user per quarter
-- ============================================================
create table if not exists quarterly_goals (
  id                                uuid primary key default gen_random_uuid(),
  user_id                           uuid not null references auth.users(id) on delete cascade,
  year                              int  not null,
  quarter                           int  not null check (quarter between 1 and 4),
  daily_dials_goal                  int  not null default 0,
  daily_dials_benchmark             int  not null default 0,
  weekly_dials_goal                 int  not null default 0,
  weekly_dials_benchmark            int  not null default 0,
  weekly_prospects_goal             int  not null default 0,
  weekly_prospects_benchmark        int  not null default 0,
  weekly_meetings_booked_goal       int  not null default 0,
  weekly_meetings_booked_benchmark  int  not null default 0,
  weekly_meetings_held_goal         int  not null default 0,
  weekly_meetings_held_benchmark    int  not null default 0,
  updated_at                        timestamptz not null default now(),
  unique (user_id, year, quarter)
);

alter table quarterly_goals enable row level security;
create policy "quarterly_goals: own"
  on quarterly_goals for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ============================================================
-- goal_logs — append-only activity log (dials, prospects added)
-- ============================================================
create table if not exists goal_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        text not null check (kind in ('dial', 'prospect-added')),
  logged_at   timestamptz not null,   -- when the activity happened, not when the row was inserted
  count       int  not null check (count >= 1),
  note        text,
  account_id  uuid references accounts(id) on delete set null
);

create index if not exists goal_logs_user_time_idx on goal_logs (user_id, logged_at);
create index if not exists goal_logs_account_idx   on goal_logs (account_id);

alter table goal_logs enable row level security;
create policy "goal_logs: own"
  on goal_logs for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ============================================================
-- saved_weeks — manually-locked or explicitly-unlocked ISO weeks
-- ============================================================
create table if not exists saved_weeks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  week_start  date not null,
  kind        text not null check (kind in ('unlocked', 'manually-saved')),
  created_at  timestamptz not null default now(),
  unique (user_id, week_start, kind)
);

alter table saved_weeks enable row level security;
create policy "saved_weeks: own"
  on saved_weeks for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ============================================================
-- meetings — everything the Meetings Tracker card renders from
-- ============================================================
create table if not exists meetings (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  first_name         text not null default '',
  last_name          text not null default '',
  title              text not null default '',
  linkedin_url       text not null default '',
  account_id         uuid references accounts(id) on delete set null,
  scheduled_for      timestamptz,
  notes              text not null default '',
  status             text not null default 'booked'
                          check (status in ('booked', 'held', 'dead-end')),
  created_at         timestamptz not null default now(),
  held_at            timestamptz,
  dead_ended_at      timestamptz,
  image_key          text,
  prospect_response  text check (
    prospect_response is null or prospect_response in (
      'no-response','accepted','declined','no-show','rescheduled','still-scheduling'
    )
  ),
  ese                text,
  held_outcome       text check (
    held_outcome is null or held_outcome in (
      'opportunity-identified','future-follow-up','dead-end'
    )
  ),
  booked_category    text check (
    booked_category is null or booked_category in ('confirmed', 'soft')
  )
);

create index if not exists meetings_user_status_idx on meetings (user_id, status);
create index if not exists meetings_scheduled_idx   on meetings (scheduled_for);

alter table meetings enable row level security;
create policy "meetings: own"
  on meetings for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ============================================================
-- meeting_updates — dated update log per meeting
-- ============================================================
create table if not exists meeting_updates (
  id          uuid primary key default gen_random_uuid(),
  meeting_id  uuid not null references meetings(id) on delete cascade,
  logged_at   timestamptz not null default now(),
  text        text not null,
  is_system   boolean not null default false
);

create index if not exists meeting_updates_meeting_idx
  on meeting_updates (meeting_id, logged_at desc);

alter table meeting_updates enable row level security;

-- Ownership is transitive through the parent meeting.
create policy "meeting_updates: own via parent"
  on meeting_updates for all
  using (
    exists (select 1 from meetings m
            where m.id = meeting_updates.meeting_id
              and m.user_id = auth.uid())
  )
  with check (
    exists (select 1 from meetings m
            where m.id = meeting_updates.meeting_id
              and m.user_id = auth.uid())
  );

-- ============================================================
-- ai_usage — per-call spend log for the shared Anthropic key
-- ============================================================
create table if not exists ai_usage (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  endpoint              text not null check (endpoint in ('autofill')),
  tokens_in             int  not null default 0,
  tokens_out            int  not null default 0,
  estimated_cost_cents  int  not null default 0,
  created_at            timestamptz not null default now()
);

create index if not exists ai_usage_user_time_idx on ai_usage (user_id, created_at);

alter table ai_usage enable row level security;

-- Users see their own usage (for a "used $X of $50 this month"
-- indicator). Only the server (service role) inserts, so there's
-- no public insert policy.
create policy "ai_usage: read own"
  on ai_usage for select using (user_id = auth.uid());

-- ============================================================
-- Triggers
-- ============================================================

-- Block signups whose email isn't on the allowlist.
create or replace function block_uninvited_signups()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from allowed_emails where lower(email) = lower(new.email)
  ) then
    raise exception 'Email % is not on the allowlist. Ask an admin to invite you.', new.email;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_invite on auth.users;
create trigger enforce_invite
before insert on auth.users
for each row execute function block_uninvited_signups();

-- Auto-create a profile row when a user signs up.
create or replace function create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists create_profile on auth.users;
create trigger create_profile
after insert on auth.users
for each row execute function create_profile_for_new_user();

-- ============================================================
-- Storage bucket for meeting screenshots
-- ============================================================
-- Run this SEPARATELY in the Supabase dashboard once, or via the
-- Supabase CLI: create a private bucket called `meeting-images`
-- and add these two policies:
--
--   Bucket: meeting-images (private)
--
--   Policy 1 — Read own objects:
--     for select
--     using (
--       bucket_id = 'meeting-images'
--       and split_part(name, '/', 1) = auth.uid()::text
--     )
--
--   Policy 2 — Write own objects:
--     for insert / update / delete
--     with check (
--       bucket_id = 'meeting-images'
--       and split_part(name, '/', 1) = auth.uid()::text
--     )
--
-- Objects are keyed as: {user_id}/meetings/{meeting_id}.{ext}
