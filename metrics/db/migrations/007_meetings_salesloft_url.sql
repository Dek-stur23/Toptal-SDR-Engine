-- ============================================================
-- Add optional salesloft_url column to meetings. Run after
-- 006_ai_endpoints.sql.
--
-- Purely additive — new column with a default of empty string so
-- existing rows are backfilled cleanly and no reads break.
-- ============================================================

alter table meetings
  add column if not exists salesloft_url text not null default '';
