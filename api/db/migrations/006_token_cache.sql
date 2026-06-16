-- Token cache fields and per-session model list
ALTER TABLE token_usage
    ADD COLUMN cache_creation_tokens BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN cache_read_tokens     BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN models                TEXT[]  NOT NULL DEFAULT '{}';

ALTER TABLE sessions
    ADD COLUMN models TEXT[] NOT NULL DEFAULT '{}';

-- Backfill models[] from existing single-model column so aggregation/UI keeps working
UPDATE token_usage SET models = ARRAY[model] WHERE model <> '' AND models = '{}';
UPDATE sessions  SET models = ARRAY[model] WHERE model <> '' AND models = '{}';
