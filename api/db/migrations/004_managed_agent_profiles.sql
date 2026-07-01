CREATE TABLE IF NOT EXISTS managed_agent_profiles (
    agent_id TEXT NOT NULL,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    business_type TEXT NOT NULL DEFAULT 'generic',
    report_types JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (agent_id, user_id),
    CONSTRAINT managed_agent_profiles_business_type_check
        CHECK (business_type IN ('generic', 'report'))
);

CREATE INDEX IF NOT EXISTS idx_managed_agent_profiles_user
    ON managed_agent_profiles(user_id);
