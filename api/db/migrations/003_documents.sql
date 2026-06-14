-- Documents (work product external links)
CREATE TABLE documents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    title           TEXT NOT NULL,
    url             TEXT NOT NULL,
    description     TEXT,
    task_id         UUID REFERENCES tasks(id),
    requirement_id  UUID REFERENCES requirements(id),
    uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_documents_user ON documents(user_id);
CREATE INDEX idx_documents_uploaded ON documents(uploaded_at DESC);
