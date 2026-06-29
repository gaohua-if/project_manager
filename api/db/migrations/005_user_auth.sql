-- AIHub SSO: extend the users role CHECK to include 'admin'.
-- (employee_id / email / password_hash columns no longer exist — AIHub is the
--  identity provider. Idempotent, forward-only.)
DO $$ BEGIN
  ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
  ALTER TABLE users ADD CONSTRAINT users_role_check
    CHECK (role IN ('admin','director','team_leader','pm','employee'));
EXCEPTION WHEN OTHERS THEN NULL; END $$;
