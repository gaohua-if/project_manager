-- 013: backfill compatibility for databases that already recorded 012 before
-- the AIHub username cache column was added there.
--
-- Fresh installs already get this column from 001_init.sql. Existing databases
-- can safely run this repeatedly.

ALTER TABLE users ADD COLUMN IF NOT EXISTS aihub_username TEXT;
