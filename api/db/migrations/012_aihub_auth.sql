-- 012: switch Aida to AIHub unified auth.
--
-- users.id changes UUID -> BIGINT (= AIHub userId) and cascades to every
-- user-referencing FK column. AIHub owns user identity now, so the legacy
-- employee_id / email / password_hash auth columns and their indexes are gone.
--
-- UUID -> BIGINT is not auto-convertible and there is no mapping to real AIHub
-- user ids, so this migration RESETS user-keyed data: tables that reference
-- users(id) are truncated (cascades handle dependents), then their FK columns
-- are altered to BIGINT. This is intentional for an internal dev platform — run
-- `docker compose down -v && docker compose up -d` to reseed. Fresh installs
-- get the BIGINT schema directly from 001..011 and skip the heavy work here.
--
-- Idempotent and safe to re-run.

-- 1) Drop every FK that points at users(id), and the auth-only indexes.
ALTER TABLE requirements       DROP CONSTRAINT IF EXISTS requirements_creator_id_fkey;
ALTER TABLE tasks              DROP CONSTRAINT IF EXISTS tasks_assignee_id_fkey;
ALTER TABLE tasks              DROP CONSTRAINT IF EXISTS tasks_creator_tl_id_fkey;
ALTER TABLE sessions           DROP CONSTRAINT IF EXISTS sessions_user_id_fkey;
ALTER TABLE token_usage        DROP CONSTRAINT IF EXISTS token_usage_user_id_fkey;
ALTER TABLE daily_reports      DROP CONSTRAINT IF EXISTS daily_reports_user_id_fkey;
ALTER TABLE documents          DROP CONSTRAINT IF EXISTS documents_user_id_fkey;
ALTER TABLE team_reports       DROP CONSTRAINT IF EXISTS team_reports_leader_id_fkey;
ALTER TABLE user_follows       DROP CONSTRAINT IF EXISTS user_follows_user_id_fkey;
ALTER TABLE ai_runs            DROP CONSTRAINT IF EXISTS ai_runs_user_id_fkey;
ALTER TABLE managed_agent_schedules DROP CONSTRAINT IF EXISTS managed_agent_schedules_user_id_fkey;

-- 2) Reset user-keyed data (no AIHub-id mapping exists for legacy UUID rows).
--    Order matters for non-cascading FKs; truncate child tables first.
TRUNCATE TABLE
    managed_agent_schedules,
    ai_runs,
    user_follows,
    team_reports,
    documents,
    daily_reports,
    token_usage,
    sessions,
    tasks,
    requirements
    RESTART IDENTITY CASCADE;
TRUNCATE TABLE users RESTART IDENTITY;

-- 3) Drop legacy AIHub-incompatible columns/indexes on users, then flip the PK.
DROP INDEX IF EXISTS idx_users_employee_id;
DROP INDEX IF EXISTS idx_users_email;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_pkey;
ALTER TABLE users DROP COLUMN IF EXISTS password_hash;
ALTER TABLE users ALTER COLUMN id DROP DEFAULT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS aihub_username TEXT;
-- employee_id / email / feishu_id become optional display/cache columns.
ALTER TABLE users ALTER COLUMN employee_id DROP NOT NULL;
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
    CHECK (role IN ('admin','director','team_leader','pm','employee'));

-- 4) users.id UUID -> BIGINT.
ALTER TABLE users ALTER COLUMN id TYPE BIGINT USING NULL;
ALTER TABLE users ALTER COLUMN id SET NOT NULL;
ALTER TABLE users ADD CONSTRAINT users_pkey PRIMARY KEY (id);

-- 5) Flip every referencing column UUID -> BIGINT.
ALTER TABLE requirements       ALTER COLUMN creator_id   TYPE BIGINT USING NULL;
ALTER TABLE tasks              ALTER COLUMN assignee_id  TYPE BIGINT USING NULL;
ALTER TABLE tasks              ALTER COLUMN creator_tl_id TYPE BIGINT USING NULL;
ALTER TABLE sessions           ALTER COLUMN user_id      TYPE BIGINT USING NULL;
ALTER TABLE token_usage        ALTER COLUMN user_id      TYPE BIGINT USING NULL;
ALTER TABLE daily_reports      ALTER COLUMN user_id      TYPE BIGINT USING NULL;
ALTER TABLE documents          ALTER COLUMN user_id      TYPE BIGINT USING NULL;
ALTER TABLE team_reports       ALTER COLUMN leader_id    TYPE BIGINT USING NULL;
ALTER TABLE user_follows       ALTER COLUMN user_id      TYPE BIGINT USING NULL;
ALTER TABLE ai_runs            ALTER COLUMN user_id      TYPE BIGINT USING NULL;
ALTER TABLE managed_agent_schedules ALTER COLUMN user_id TYPE BIGINT USING NULL;

-- 6) Recreate the FKs against the BIGINT users(id).
ALTER TABLE requirements       ADD CONSTRAINT requirements_creator_id_fkey   FOREIGN KEY (creator_id) REFERENCES users(id);
ALTER TABLE tasks              ADD CONSTRAINT tasks_assignee_id_fkey        FOREIGN KEY (assignee_id) REFERENCES users(id);
ALTER TABLE tasks              ADD CONSTRAINT tasks_creator_tl_id_fkey      FOREIGN KEY (creator_tl_id) REFERENCES users(id);
ALTER TABLE sessions           ADD CONSTRAINT sessions_user_id_fkey         FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE token_usage        ADD CONSTRAINT token_usage_user_id_fkey      FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE daily_reports      ADD CONSTRAINT daily_reports_user_id_fkey    FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE documents          ADD CONSTRAINT documents_user_id_fkey        FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE team_reports       ADD CONSTRAINT team_reports_leader_id_fkey   FOREIGN KEY (leader_id) REFERENCES users(id);
ALTER TABLE user_follows       ADD CONSTRAINT user_follows_user_id_fkey     FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE ai_runs            ADD CONSTRAINT ai_runs_user_id_fkey          FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE managed_agent_schedules ADD CONSTRAINT managed_agent_schedules_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
