-- SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
-- SPDX-License-Identifier: AGPL-3.0-only

-- Note table — exhibitor scope (ADR-0005 template: exhibitor).
-- Visible only to the exhibitor (user_id) who created the row; shared across Clubs.

CREATE TABLE IF NOT EXISTS sample.notes (
  id       UUID NOT NULL PRIMARY KEY,
  user_id  UUID NOT NULL,
  name     TEXT NOT NULL
);

ALTER TABLE sample.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sample.notes FORCE ROW LEVEL SECURITY;

CREATE POLICY notes_exhibitor ON sample.notes
  AS PERMISSIVE FOR ALL TO app_user
  USING (user_id = nullif(current_setting('app.user_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON sample.notes TO app_user;
