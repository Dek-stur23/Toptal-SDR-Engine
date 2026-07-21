-- ============================================================
-- Per-user ESE (Enterprise Sales Executive) list. Run after
-- 003_user_id_defaults.sql.
--
-- Replaces the hardcoded ESE_OPTIONS list in the app with a
-- per-user table each SDR manages themselves from the Accounts
-- page. `meetings.ese` stays plain text — this table just backs
-- the dropdown; deleting an ESE here does NOT touch meetings that
-- already reference the name.
-- ============================================================

create table if not exists eses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now()
);

create unique index if not exists eses_user_name_lower_uk
  on eses (user_id, lower(name));
create index if not exists eses_user_idx on eses (user_id);

alter table eses enable row level security;
create policy "eses: own"
  on eses for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
