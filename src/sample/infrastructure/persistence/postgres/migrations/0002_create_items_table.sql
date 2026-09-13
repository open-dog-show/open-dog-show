-- SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
-- SPDX-License-Identifier: AGPL-3.0-only

-- Item table — club scope (ADR-0005 template: club).
-- Read-open, write-scoped: any scope may discover a club-owned row (a hybrid
-- child aggregate must be able to resolve this row's owning Club when created
-- under a different acting scope, e.g. exhibitor — ADR-0026), but only the
-- owning Club may create/modify/remove it. CREATE POLICY's FOR clause takes
-- exactly one command, and INSERT supports only WITH CHECK (there is no
-- pre-existing row for USING to filter), so the write predicate needs one
-- policy per mutating command rather than one shared ALL-style policy.

CREATE TABLE IF NOT EXISTS sample.items (
  id       UUID NOT NULL PRIMARY KEY,
  club_id  UUID NOT NULL,
  user_id  UUID NOT NULL,
  name     TEXT NOT NULL
);

ALTER TABLE sample.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sample.items FORCE ROW LEVEL SECURITY;

CREATE POLICY items_read ON sample.items
  AS PERMISSIVE FOR SELECT TO app_user
  USING (true);

CREATE POLICY items_insert ON sample.items
  AS PERMISSIVE FOR INSERT TO app_user
  WITH CHECK (club_id = nullif(current_setting('app.club_id', true), '')::uuid);

CREATE POLICY items_update ON sample.items
  AS PERMISSIVE FOR UPDATE TO app_user
  USING (club_id = nullif(current_setting('app.club_id', true), '')::uuid)
  WITH CHECK (club_id = nullif(current_setting('app.club_id', true), '')::uuid);

CREATE POLICY items_delete ON sample.items
  AS PERMISSIVE FOR DELETE TO app_user
  USING (club_id = nullif(current_setting('app.club_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON sample.items TO app_user;
