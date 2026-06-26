ALTER TABLE team_reports
    ADD COLUMN IF NOT EXISTS status TEXT,
    ADD COLUMN IF NOT EXISTS submitted_content TEXT,
    ADD COLUMN IF NOT EXISTS saved_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS submitted_to TEXT;

ALTER TABLE team_reports
    DROP CONSTRAINT IF EXISTS team_reports_status_check,
    ADD CONSTRAINT team_reports_status_check
    CHECK (status IS NULL OR status IN ('saved', 'submitted'));

ALTER TABLE team_reports
    DROP CONSTRAINT IF EXISTS team_reports_submitted_to_check,
    ADD CONSTRAINT team_reports_submitted_to_check
    CHECK (submitted_to IS NULL OR submitted_to IN ('director'));

UPDATE team_reports
SET
    status = CASE WHEN submitted_at IS NOT NULL THEN 'submitted' ELSE 'saved' END,
    submitted_content = CASE WHEN submitted_at IS NOT NULL THEN content ELSE submitted_content END,
    saved_at = COALESCE(saved_at, updated_at)
WHERE status IS NULL;

UPDATE team_reports
SET submitted_to = 'director'
WHERE submitted_at IS NOT NULL AND submitted_to IS NULL;

ALTER TABLE department_reports
    ADD COLUMN IF NOT EXISTS status TEXT,
    ADD COLUMN IF NOT EXISTS saved_at TIMESTAMPTZ;

ALTER TABLE department_reports
    DROP CONSTRAINT IF EXISTS department_reports_status_check,
    ADD CONSTRAINT department_reports_status_check
    CHECK (status IS NULL OR status IN ('saved', 'archived'));

UPDATE department_reports
SET
    status = CASE WHEN archived_at IS NOT NULL THEN 'saved' ELSE status END,
    saved_at = COALESCE(saved_at, archived_at)
WHERE archived_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_team_reports_status_date
    ON team_reports(status, report_date DESC);

CREATE INDEX IF NOT EXISTS idx_department_reports_status_date
    ON department_reports(status, report_date DESC);
