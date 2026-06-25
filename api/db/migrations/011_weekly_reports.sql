CREATE TABLE IF NOT EXISTS team_weekly_reports (
    id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id                    UUID NOT NULL REFERENCES teams(id),
    leader_id                  UUID NOT NULL REFERENCES users(id),
    week_start                 DATE NOT NULL,
    content                    TEXT NOT NULL,
    source_daily_report_ids    UUID[] NOT NULL DEFAULT '{}',
    source_team_report_ids     UUID[] NOT NULL DEFAULT '{}',
    source_task_ids            UUID[] NOT NULL DEFAULT '{}',
    submitted_at               TIMESTAMPTZ,
    created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (team_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_team_weekly_reports_team_week ON team_weekly_reports(team_id, week_start DESC);

CREATE TABLE IF NOT EXISTS department_weekly_reports (
    id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    week_start                    DATE NOT NULL,
    content                       TEXT NOT NULL,
    source_team_weekly_report_ids UUID[] NOT NULL DEFAULT '{}',
    archived_at                   TIMESTAMPTZ,
    created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (week_start)
);

CREATE INDEX IF NOT EXISTS idx_department_weekly_reports_week ON department_weekly_reports(week_start DESC);
