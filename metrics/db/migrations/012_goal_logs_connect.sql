-- ============================================================
-- Add 'connect' to the goal_logs activity kinds. Run after
-- 011_account_activity.sql.
--
-- goal_logs tracked dials and prospects added; connects is now a
-- loggable activity too (Log connects button on Goals & Metrics).
-- Purely additive: widen the kind check constraint. Existing rows and
-- the two existing kinds are untouched.
-- ============================================================

alter table goal_logs drop constraint if exists goal_logs_kind_check;
alter table goal_logs add constraint goal_logs_kind_check
  check (kind in ('dial', 'connect', 'prospect-added'));
