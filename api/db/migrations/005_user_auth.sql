-- User auth refactor: employee_id + password login, admin role, registration support.
-- Forward-only, idempotent. Run on every API boot.

-- 1) Extend users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- 2) Relax role CHECK to include 'admin'
DO $$ BEGIN
  ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
  ALTER TABLE users ADD CONSTRAINT users_role_check
    CHECK (role IN ('admin','director','team_leader','pm','employee'));
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 3) Backfill seeded users with employee_id + default password 'Changeme123!'.
--    bcrypt cost=10 hash precomputed; same hash reused for every legacy row.
UPDATE users SET
  employee_id = CASE name
    WHEN '李总监' THEN 'li_director'
    WHEN '陈PM'   THEN 'chen_pm'
    WHEN '刘TL'   THEN 'liu_tl'
    WHEN '赵TL'   THEN 'zhao_tl'
    WHEN '孙TL'   THEN 'sun_tl'
    WHEN '张三'   THEN 'zhangsan'
    WHEN '李四'   THEN 'lisi'
    WHEN '王五'   THEN 'wangwu'
    WHEN '赵六'   THEN 'zhaoliu'
    WHEN '钱七'   THEN 'qianqi'
    WHEN '孙八'   THEN 'sunba'
    WHEN '周九'   THEN 'zhoujiu'
    WHEN '吴十'   THEN 'wushi'
    ELSE 'legacy_' || lower(regexp_replace(name, '[^a-zA-Z0-9]', '', 'g'))
  END,
  password_hash = '$2a$10$2PbF4ynr.BH0jolD1gUnKuzCxDJKYm2HYXQd73GzMeybt8ZElHjMO'
WHERE employee_id IS NULL;

-- 4) Ensure email is set for legacy rows.
UPDATE users SET email = employee_id || '@example.com' WHERE email IS NULL;

-- 5) Enforce NOT NULL + uniqueness.
ALTER TABLE users ALTER COLUMN employee_id SET NOT NULL;
ALTER TABLE users ALTER COLUMN email SET NOT NULL;
ALTER TABLE users ALTER COLUMN password_hash SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_employee_id ON users(employee_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 6) Idempotent admin user (employee_id 'admin', password 'Admin@123!').
INSERT INTO users (id, employee_id, name, email, role, password_hash, team_id)
VALUES ('b0000000-0000-0000-0000-000000000099',
        'admin',
        '管理员',
        'admin@example.com',
        'admin',
        '$2a$10$9SD8eacmbngnudR/8noNPOgC.3K8CwVBFmFDiIHD6O48OKzTvO4Ue',
        NULL)
ON CONFLICT (employee_id) DO NOTHING;
