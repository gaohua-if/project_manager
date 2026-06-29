-- Seed teams only.
-- Users are NO LONGER seeded: Aida uses AIHub as its unified auth provider, and
-- users.rows are created lazily on first AIHub login (id = AIHub userId). Run
-- `docker compose down -v && docker compose up -d` after upgrading to reseed.
INSERT INTO teams (id, name) VALUES
    ('a0000000-0000-0000-0000-000000000001', 'AI工程'),
    ('a0000000-0000-0000-0000-000000000002', '推理加速'),
    ('a0000000-0000-0000-0000-000000000003', '模型训练')
ON CONFLICT (name) DO NOTHING;
