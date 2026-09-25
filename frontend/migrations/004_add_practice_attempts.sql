-- Phase 10B: persistence foundation for online practice.
-- Worksheet -> PracticeAttempt -> PracticeAnswer. Practice is
-- authenticated-only (Phase 10 product decision): unlike worksheets,
-- practice_attempts has no anonymous_id column at all - owner_id is
-- always a real Better Auth user id, never optional.
--
-- This migration adds tables only. It does not implement submission,
-- scoring, normalization, or any API/UI - those are later Phase 10
-- stories. correct_count/score_percent exist as columns now so a later
-- story can fill them in without another schema change, but nothing in
-- this phase ever writes to them.

CREATE TABLE practice_attempts (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  worksheet_id   UUID        NOT NULL REFERENCES worksheets (id),
  owner_id       UUID        NOT NULL REFERENCES "user" (id),
  status         TEXT        NOT NULL DEFAULT 'in_progress'
                   CHECK (status IN ('in_progress', 'submitted')),
  question_count INTEGER     NOT NULL,
  correct_count  INTEGER     NULL,
  score_percent  NUMERIC(5, 2) NULL,
  started_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at   TIMESTAMPTZ NULL
);

-- No FK ON DELETE clause on worksheet_id/owner_id (defaults to NO ACTION,
-- i.e. restrictive): mirrors migration 003's worksheets.owner_id FK,
-- which also has no ON DELETE clause. Neither worksheets nor users are
-- deleted by any current app flow, so this is untested territory either
-- way; the conservative choice is to block a delete that would orphan
-- practice history rather than silently cascade it away.

-- Serves "my recent attempts" (listAttemptsByOwnerId), newest first.
CREATE INDEX practice_attempts_owner_id_started_at_idx
  ON practice_attempts (owner_id, started_at DESC);

-- Serves "my attempts on this worksheet" (listAttemptsByWorksheetForOwner).
CREATE INDEX practice_attempts_worksheet_id_owner_id_idx
  ON practice_attempts (worksheet_id, owner_id);

CREATE TABLE practice_answers (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id  UUID        NOT NULL REFERENCES practice_attempts (id),
  -- Not a FK: worksheet questions live inside worksheets.questions JSONB,
  -- not a separate table, so question_id is only ever matched against
  -- that JSONB at the application layer, always scoped by attempt_id
  -- (and therefore by the attempt's worksheet_id) - never looked up by
  -- question_id alone.
  question_id TEXT        NOT NULL,
  answer      TEXT        NOT NULL,
  is_correct  BOOLEAN     NULL,
  answered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (attempt_id, question_id)
);

-- No separate index on attempt_id: the UNIQUE(attempt_id, question_id)
-- constraint above already creates a composite index with attempt_id as
-- its leading column, which serves listAnswersForAttempt(attempt_id)
-- without a redundant second index.

-- No FK ON DELETE clause on attempt_id either, for the same conservative
-- reasoning as practice_attempts above - attempts are never deleted by
-- any current app flow.
