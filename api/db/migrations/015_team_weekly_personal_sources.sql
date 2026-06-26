ALTER TABLE team_weekly_reports
    ADD COLUMN IF NOT EXISTS source_personal_weekly_report_ids UUID[] NOT NULL DEFAULT '{}';
