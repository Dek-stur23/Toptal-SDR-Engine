-- ============================================================
-- Opportunities. Run after 004_eses.sql.
--
-- An opportunity is a child of a meeting that was marked Held with
-- held_outcome = 'opportunity-identified'. One per meeting.
--
-- opportunities: the record itself + workflow status
-- opportunity_updates: rolling log of updates, mirrors meeting_updates
--
-- Purely additive — creates new tables and their RLS policies.
-- Does not touch meetings, accounts, or any existing table.
-- ============================================================

create table if not exists opportunities (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  meeting_id        uuid not null references meetings(id) on delete cascade,
  title             text not null default '',
  pain              text not null default '',
  solution_area     text check (
    solution_area is null or solution_area in (
      'staff-augmentation', 'professional-services'
    )
  ),
  timeline          text check (
    timeline is null or timeline in ('now', 'next-month', 'next-quarter')
  ),
  next_step_text    text not null default '',
  next_step_owner   text check (
    next_step_owner is null or next_step_owner in ('SDR', 'ESE')
  ),
  status            text not null default 'open' check (
    status in ('open', 'won-sta', 'won-job', 'lost')
  ),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (meeting_id)
);

create index if not exists opportunities_user_status_idx
  on opportunities (user_id, status);
create index if not exists opportunities_meeting_idx
  on opportunities (meeting_id);

alter table opportunities enable row level security;
create policy "opportunities: own"
  on opportunities for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Trigger to bump updated_at on any UPDATE. The 2-day "action
-- overdue" badge reads this column, so it has to reflect the most
-- recent change (form save, next-step edit, status change, etc.),
-- not just the row's creation time.
create or replace function set_opportunity_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists bump_opportunity_updated_at on opportunities;
create trigger bump_opportunity_updated_at
before update on opportunities
for each row execute function set_opportunity_updated_at();

-- ---- opportunity_updates ----

create table if not exists opportunity_updates (
  id              uuid primary key default gen_random_uuid(),
  opportunity_id  uuid not null references opportunities(id) on delete cascade,
  logged_at       timestamptz not null default now(),
  text            text not null,
  is_system       boolean not null default false
);

create index if not exists opportunity_updates_opp_idx
  on opportunity_updates (opportunity_id, logged_at desc);

alter table opportunity_updates enable row level security;

-- Ownership is transitive through the parent opportunity, mirroring
-- how meeting_updates delegates to its parent meeting.
create policy "opportunity_updates: own via parent"
  on opportunity_updates for all
  using (
    exists (
      select 1 from opportunities o
      where o.id = opportunity_updates.opportunity_id
        and o.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from opportunities o
      where o.id = opportunity_updates.opportunity_id
        and o.user_id = auth.uid()
    )
  );
