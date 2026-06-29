CREATE TABLE IF NOT EXISTS managed_agent_schedules (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name           TEXT NOT NULL,
    agent_id       TEXT NOT NULL,
    model_id       TEXT,
    message        TEXT NOT NULL,
    params_json    JSONB NOT NULL DEFAULT '{}'::jsonb,
    schedule_type  TEXT NOT NULL DEFAULT 'daily'
                   CHECK (schedule_type IN ('daily', 'weekly')),
    weekdays_json  JSONB NOT NULL DEFAULT '[]'::jsonb,
    time_of_day    TEXT NOT NULL,
    timezone       TEXT NOT NULL DEFAULT 'Asia/Shanghai',
    enabled        BOOLEAN NOT NULL DEFAULT true,
    last_run_at    TIMESTAMPTZ,
    last_ai_run_id UUID REFERENCES ai_runs(id),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_managed_agent_schedules_user
    ON managed_agent_schedules(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_managed_agent_schedules_enabled
    ON managed_agent_schedules(enabled, time_of_day);
