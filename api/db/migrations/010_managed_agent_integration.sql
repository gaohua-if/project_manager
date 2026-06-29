ALTER TABLE daily_reports
    ADD COLUMN IF NOT EXISTS generation_mode TEXT NOT NULL DEFAULT 'default',
    ADD COLUMN IF NOT EXISTS managed_agent_run_id UUID,
    ADD COLUMN IF NOT EXISTS agent_id TEXT,
    ADD COLUMN IF NOT EXISTS agent_version_id INTEGER,
    ADD COLUMN IF NOT EXISTS model_id TEXT;

CREATE TABLE ai_runs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             BIGINT NOT NULL REFERENCES users(id),
    business_type       TEXT NOT NULL,
    business_id         UUID,
    runtime_type        TEXT NOT NULL,
    agent_id            TEXT NOT NULL,
    agent_version_id    INTEGER,
    external_task_id    TEXT,
    external_session_id TEXT,
    model_id            TEXT,
    status              TEXT NOT NULL DEFAULT 'pending',
    input_ref_json      JSONB NOT NULL DEFAULT '{}'::jsonb,
    output_ref_json     JSONB NOT NULL DEFAULT '{}'::jsonb,
    error_message       TEXT,
    started_at          TIMESTAMPTZ,
    finished_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_runs_user_created ON ai_runs(user_id, created_at DESC);
CREATE INDEX idx_ai_runs_external_task ON ai_runs(external_task_id);
CREATE INDEX idx_ai_runs_business ON ai_runs(business_type, business_id);
