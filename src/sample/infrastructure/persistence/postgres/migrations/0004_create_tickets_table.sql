-- SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
-- SPDX-License-Identifier: AGPL-3.0-only

-- Ticket table — hybrid scope (ADR-0005 template: hybrid).
-- Owned by the referenced Item's Club, but also visible to
-- the exhibitor (user_id) who created the row — disjunctive predicate.

CREATE TABLE IF NOT EXISTS sample.tickets (
  id                    UUID NOT NULL PRIMARY KEY,
  club_id               UUID NOT NULL,
  user_id               UUID NOT NULL,
  item_id UUID NOT NULL REFERENCES sample.items(id),
  name                  TEXT NOT NULL
);

ALTER TABLE sample.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE sample.tickets FORCE ROW LEVEL SECURITY;

CREATE POLICY tickets_hybrid ON sample.tickets
  AS PERMISSIVE FOR ALL TO app_user
  USING (
    club_id    = nullif(current_setting('app.club_id',   true), '')::uuid
    OR user_id = nullif(current_setting('app.user_id', true), '')::uuid
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON sample.tickets TO app_user;
