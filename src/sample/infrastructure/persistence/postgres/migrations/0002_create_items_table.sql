-- SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
-- SPDX-License-Identifier: AGPL-3.0-only

-- Item table — club scope (ADR-0005 template: club).
-- Visible only to the owning Club.

CREATE TABLE IF NOT EXISTS sample.items (
  id       UUID NOT NULL PRIMARY KEY,
  club_id  UUID NOT NULL,
  user_id  UUID NOT NULL,
  name     TEXT NOT NULL
);

ALTER TABLE sample.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sample.items FORCE ROW LEVEL SECURITY;

CREATE POLICY items_club ON sample.items
  AS PERMISSIVE FOR ALL TO app_user
  USING (club_id = nullif(current_setting('app.club_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON sample.items TO app_user;
