-- Requirements P0: task progress, derived blocking, completion timestamps, and follows.

ALTER TABLE requirements DROP CONSTRAINT IF EXISTS requirements_status_check;
ALTER TABLE requirements ALTER COLUMN status SET DEFAULT 'todo';
ALTER TABLE requirements
    ADD CONSTRAINT requirements_status_check
    CHECK (status IN ('todo', 'review', 'active', 'completed', 'cancelled'));

ALTER TABLE requirements
    ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

UPDATE requirements
SET completed_at = COALESCE(completed_at, updated_at)
WHERE status = 'completed';

ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS progress INTEGER NOT NULL DEFAULT 0
    CHECK (progress >= 0 AND progress <= 100);

ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

UPDATE tasks
SET progress = 100,
    completed_at = COALESCE(completed_at, updated_at)
WHERE status = 'done';

-- blocked is a display/risk projection in P0, never a stored task state.
UPDATE tasks
SET status = 'in_progress'
WHERE status = 'blocked';

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE tasks
    ADD CONSTRAINT tasks_status_check
    CHECK (status IN ('todo', 'in_progress', 'done'));

CREATE TABLE IF NOT EXISTS user_follows (
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_type TEXT NOT NULL CHECK (target_type IN ('requirement', 'task')),
    target_id   UUID NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_user_follows_target
    ON user_follows (target_type, target_id);

CREATE INDEX IF NOT EXISTS idx_tasks_due_date
    ON tasks (due_date)
    WHERE status <> 'done';
