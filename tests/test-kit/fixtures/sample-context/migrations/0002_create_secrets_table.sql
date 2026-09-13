-- SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
-- SPDX-License-Identifier: AGPL-3.0-only

-- An RLS-protected table used to prove the harness's app_user pool is
-- row-level-security enforced while the superuser pool bypasses RLS.
CREATE TABLE IF NOT EXISTS sample_context.secrets (
  id   UUID        NOT NULL PRIMARY KEY,
  name TEXT        NOT NULL
);

ALTER TABLE sample_context.secrets ENABLE ROW LEVEL SECURITY;

-- app_user may attempt the write (privileges granted below) but the
-- WITH CHECK (false) policy blocks every row, so inserts raise an RLS
-- violation. The superuser bypasses RLS entirely, so its inserts succeed.
CREATE POLICY secrets_block_all ON sample_context.secrets
  FOR ALL TO app_user USING (false) WITH CHECK (false);

GRANT USAGE ON SCHEMA sample_context TO app_user;
GRANT SELECT, INSERT ON sample_context.secrets TO app_user;