CREATE TABLE IF NOT EXISTS personal_weekly_reports (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL REFERENCES users(id),
    week_start              DATE NOT NULL,
    week_end                DATE NOT NULL,
    content                 TEXT NOT NULL,
    submitted_content       TEXT,
    status                  TEXT NOT NULL,
    saved_at                TIMESTAMPTZ,
    submitted_at            TIMESTAMPTZ,
    submitted_to            TEXT,
    source_daily_report_ids UUID[] NOT NULL DEFAULT '{}',
    source_session_ids      UUID[] NOT NULL DEFAULT '{}',
    source_task_ids         UUID[] NOT NULL DEFAULT '{}',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, week_start)
);

ALTER TABLE personal_weekly_reports
    DROP CONSTRAINT IF EXISTS personal_weekly_reports_status_check,
    ADD CONSTRAINT personal_weekly_reports_status_check
    CHECK (status IN ('saved', 'submitted'));

ALTER TABLE personal_weekly_reports
    DROP CONSTRAINT IF EXISTS personal_weekly_reports_submitted_to_check,
    ADD CONSTRAINT personal_weekly_reports_submitted_to_check
    CHECK (submitted_to IS NULL OR submitted_to IN ('team_leader', 'director'));

CREATE INDEX IF NOT EXISTS idx_personal_weekly_reports_user_week
    ON personal_weekly_reports(user_id, week_start DESC);

CREATE INDEX IF NOT EXISTS idx_personal_weekly_reports_status_week
    ON personal_weekly_reports(status, week_start DESC);
