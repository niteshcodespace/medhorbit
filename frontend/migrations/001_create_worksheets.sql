-- Immutable snapshot of a generated worksheet. gen_random_uuid() is built into
-- PostgreSQL 13+, so no extension is required.
CREATE TABLE worksheets (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  anonymous_id   TEXT        NOT NULL,
  class_id       TEXT        NOT NULL,
  subject_id     TEXT        NOT NULL,
  topic_id       TEXT        NOT NULL,
  difficulty     TEXT        NOT NULL,
  question_count INTEGER     NOT NULL,
  questions      JSONB       NOT NULL,
  generated_at   TIMESTAMPTZ NOT NULL,
  saved_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Serves the anonymous "My Worksheets" list, newest first.
CREATE INDEX worksheets_anonymous_id_saved_at_idx
  ON worksheets (anonymous_id, saved_at DESC);
