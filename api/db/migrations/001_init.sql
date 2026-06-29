-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Teams
CREATE TABLE teams (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Users
-- id is the AIHub user id (BIGINT). Aida uses AIHub as its unified auth provider,
-- so the user id is owned by AIHub, not generated here.
CREATE TABLE users (
    id             BIGINT PRIMARY KEY,
    name           TEXT NOT NULL,
    aihub_username TEXT,
    email          TEXT,
    role           TEXT NOT NULL CHECK (role IN ('director', 'team_leader', 'pm', 'employee')),
    team_id        UUID REFERENCES teams(id),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_users_team ON users(team_id);
CREATE INDEX idx_users_role ON users(role);

-- Requirements
CREATE TABLE requirements (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title               TEXT NOT NULL,
    description         TEXT NOT NULL,
    feishu_doc_url      TEXT,
    acceptance_criteria TEXT[],
    creator_id          BIGINT NOT NULL REFERENCES users(id),
    creator_role        TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    priority            TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    progress            INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    deadline            DATE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_requirements_status ON requirements(status);
CREATE INDEX idx_requirements_creator ON requirements(creator_id);

-- Requirement <-> Team (many-to-many)
CREATE TABLE requirement_teams (
    requirement_id UUID NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
    team_id        UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    PRIMARY KEY (requirement_id, team_id)
);

-- Tasks
CREATE TABLE tasks (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requirement_id          UUID NOT NULL REFERENCES requirements(id),
    title                   TEXT NOT NULL,
    acceptance_criteria_ids INTEGER[],
    assignee_id             BIGINT REFERENCES users(id),
    creator_tl_id           BIGINT NOT NULL REFERENCES users(id),
    status                  TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done', 'blocked')),
    priority                TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    due_date                DATE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tasks_requirement ON tasks(requirement_id);
CREATE INDEX idx_tasks_assignee ON tasks(assignee_id);
CREATE INDEX idx_tasks_status ON tasks(status);

-- Task Dependencies
CREATE TABLE task_dependencies (
    task_id       UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    depends_on_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    dep_type      TEXT NOT NULL DEFAULT 'finish_to_start',
    PRIMARY KEY (task_id, depends_on_id),
    CHECK (task_id != depends_on_id)
);

-- Sessions
CREATE TABLE sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_ref     TEXT NOT NULL,
    user_id         BIGINT NOT NULL REFERENCES users(id),
    agent_type      TEXT NOT NULL DEFAULT 'claude_code',
    started_at      TIMESTAMPTZ NOT NULL,
    ended_at        TIMESTAMPTZ,
    duration_secs   INTEGER,
    model           TEXT,
    summary         TEXT,
    tool_calls_json JSONB,
    git_commits     TEXT[],
    task_id         UUID REFERENCES tasks(id),
    requirement_id  UUID REFERENCES requirements(id),
    match_confidence FLOAT,
    raw_log_url     TEXT,
    uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_task ON sessions(task_id);
CREATE INDEX idx_sessions_started ON sessions(started_at);
CREATE INDEX idx_sessions_user_date ON sessions(user_id, started_at DESC);
CREATE UNIQUE INDEX idx_sessions_ref ON sessions(session_ref, user_id);

-- Token Usage
CREATE TABLE token_usage (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id     UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    user_id        BIGINT NOT NULL REFERENCES users(id),
    task_id        UUID REFERENCES tasks(id),
    requirement_id UUID REFERENCES requirements(id),
    agent_type     TEXT NOT NULL,
    model          TEXT NOT NULL,
    input_tokens   BIGINT NOT NULL DEFAULT 0,
    output_tokens  BIGINT NOT NULL DEFAULT 0,
    total_tokens   BIGINT NOT NULL DEFAULT 0,
    recorded_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_token_session ON token_usage(session_id);
CREATE INDEX idx_token_user ON token_usage(user_id);
CREATE INDEX idx_token_task ON token_usage(task_id);
CREATE INDEX idx_token_recorded ON token_usage(recorded_at);
CREATE INDEX idx_token_model ON token_usage(model);

-- Daily Reports
CREATE TABLE daily_reports (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        BIGINT NOT NULL REFERENCES users(id),
    report_date    DATE NOT NULL,
    content        TEXT NOT NULL,
    edited         BOOLEAN NOT NULL DEFAULT FALSE,
    feishu_doc_url TEXT,
    session_ids    UUID[],
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, report_date)
);
CREATE INDEX idx_reports_user_date ON daily_reports(user_id, report_date DESC);
