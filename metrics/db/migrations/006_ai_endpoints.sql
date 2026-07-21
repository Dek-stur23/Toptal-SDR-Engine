-- ============================================================
-- Extend the ai_usage.endpoint check constraint to cover the new
-- "opportunity-next-step" endpoint used by the Suggest Next Step
-- button on opportunity cards. Run after 005_opportunities.sql.
-- ============================================================

alter table ai_usage drop constraint if exists ai_usage_endpoint_check;

alter table ai_usage
  add constraint ai_usage_endpoint_check
  check (endpoint in ('autofill', 'opportunity-next-step'));
