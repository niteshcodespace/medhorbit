-- Phase 9D-2A: database foundation for authenticated worksheet ownership.
-- Adds a nullable owner_id, no default other than NULL, so every worksheet
-- saved through the existing (unmodified) save() path continues to be
-- owner_id IS NULL, exactly as today. Claiming anonymous worksheets into an
-- account is a later phase; this migration only adds the column, the FK,
-- and an index for the future owner-scoped reads.
ALTER TABLE worksheets
  ADD COLUMN owner_id UUID NULL REFERENCES "user" (id);

-- Serves the future "My Worksheets" list for signed-in owners, newest first.
-- Partial so it costs nothing for the (currently 100%) anonymous rows.
CREATE INDEX worksheets_owner_id_saved_at_idx
  ON worksheets (owner_id, saved_at DESC)
  WHERE owner_id IS NOT NULL;
