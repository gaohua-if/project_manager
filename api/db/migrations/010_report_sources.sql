-- Source tracking for generated summary reports.
ALTER TABLE team_reports
    ADD COLUMN IF NOT EXISTS source_daily_report_ids UUID[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;

UPDATE team_reports
SET source_daily_report_ids = member_report_ids
WHERE source_daily_report_ids = '{}';

CREATE TABLE IF NOT EXISTS department_reports (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_date            DATE NOT NULL,
    content                TEXT NOT NULL,
    source_team_report_ids UUID[] NOT NULL DEFAULT '{}',
    archived_at            TIMESTAMPTZ,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (report_date)
);

CREATE INDEX IF NOT EXISTS idx_department_reports_date ON department_reports(report_date DESC);
