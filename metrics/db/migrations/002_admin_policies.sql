-- ============================================================
-- Admin policies. Run after 001_initial.sql.
--
-- Lets rows with profiles.is_admin = true manage the invite gate
-- from the in-app /admin/invites page instead of the Supabase
-- dashboard.
-- ============================================================

create policy "allowed_emails: admin insert"
  on allowed_emails for insert
  with check (
    exists (
      select 1 from profiles
      where id = auth.uid() and is_admin = true
    )
  );

create policy "allowed_emails: admin delete"
  on allowed_emails for delete
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and is_admin = true
    )
  );
