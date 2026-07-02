ALTER TABLE managed_agent_schedules
    ADD COLUMN IF NOT EXISTS run_kind TEXT NOT NULL DEFAULT 'generic_agent'
        CHECK (run_kind IN ('generic_agent', 'report_agent')),
    ADD COLUMN IF NOT EXISTS start_prompt_values_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS report_config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS next_run_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_error TEXT,
    ADD COLUMN IF NOT EXISTS last_skip_reason TEXT,
    ADD COLUMN IF NOT EXISTS last_skip_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_skipped_trigger_at TIMESTAMPTZ;

UPDATE managed_agent_schedules
SET start_prompt_values_json = params_json
WHERE start_prompt_values_json = '{}'::jsonb
  AND params_json <> '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_managed_agent_schedules_due
    ON managed_agent_schedules(enabled, next_run_at)
    WHERE enabled = true;
