ALTER TABLE tasks ADD COLUMN IF NOT EXISTS acceptance_criteria TEXT[];
ALTER TABLE tasks DROP COLUMN IF EXISTS acceptance_criteria_ids;
