-- ============================================================
-- user_id defaults. Run after 002_admin_policies.sql.
--
-- The base tables in 001_initial.sql declare `user_id uuid not null`
-- with no default. The app inserts rows WITHOUT specifying user_id and
-- relies on RLS `with check (user_id = auth.uid())` to bind each row to
-- the caller — which only works if the column defaults to the caller's
-- id. Stamp it automatically here so those inserts satisfy the policy.
--
-- Tables created in later migrations (eses, opportunities,
-- activity_events) already declare `default auth.uid()` inline, so they
-- are intentionally not repeated here.
--
-- Idempotent: setting a column default is safe to re-run.
-- ============================================================

alter table accounts        alter column user_id set default auth.uid();
alter table quarterly_goals alter column user_id set default auth.uid();
alter table goal_logs       alter column user_id set default auth.uid();
alter table saved_weeks     alter column user_id set default auth.uid();
alter table meetings        alter column user_id set default auth.uid();
