ALTER TABLE daily_reports
    ADD COLUMN IF NOT EXISTS status TEXT,
    ADD COLUMN IF NOT EXISTS submitted_content TEXT,
    ADD COLUMN IF NOT EXISTS saved_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS submitted_to TEXT;

ALTER TABLE daily_reports
    DROP CONSTRAINT IF EXISTS daily_reports_status_check,
    ADD CONSTRAINT daily_reports_status_check
    CHECK (status IS NULL OR status IN ('saved', 'submitted'));

ALTER TABLE daily_reports
    DROP CONSTRAINT IF EXISTS daily_reports_submitted_to_check,
    ADD CONSTRAINT daily_reports_submitted_to_check
    CHECK (submitted_to IS NULL OR submitted_to IN ('team_leader', 'director'));

CREATE INDEX IF NOT EXISTS idx_daily_reports_status_date
    ON daily_reports(status, report_date DESC);
