-- ============================================================
-- Optional default ESE per account. Run after
-- 008_weekly_goal_snapshots.sql.
--
-- Stored as a plain text name (matching how meetings.ese is stored)
-- so it survives ESE renames and works even if the row in the eses
-- table is later deleted. Meetings that pick this account get their
-- ESE field auto-populated when the field is empty.
-- ============================================================

alter table accounts
  add column if not exists default_ese text default null;
