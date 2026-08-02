-- SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
-- SPDX-License-Identifier: AGPL-3.0-only

-- Create the runtime app role (non-owner; RLS is enforced for non-owner roles).
-- The bootstrapRole in migration-runner also creates this, but we include it here
-- for environments that run migrations directly without the runner.
--
-- NOTE: The hardcoded password is for development / CI only.
-- Production deployments MUST replace 'app_user' with a strong, environment-supplied
-- secret before applying this migration.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user WITH LOGIN PASSWORD 'app_user' NOINHERIT;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA sample TO app_user;

-- =============================================================================
-- RLS policy templates (ADR-0005)
--
-- Three active templates are applied per table:
--
--   tenant   — rows owned by one Club; key = tenant_id
--   USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
--
--   exhibitor — cross-tenant participant data; key = account_id
--   USING (account_id = nullif(current_setting('app.account_id', true), '')::uuid)
--
--   hybrid   — Club-owned but exhibitor-readable; disjunctive predicate
--   USING (
--     tenant_id  = nullif(current_setting('app.tenant_id',  true), '')::uuid
--     OR account_id = nullif(current_setting('app.account_id', true), '')::uuid
--   )
--
--   platform — reference/operator data; no policy (role-gated or RLS-exempt).
--
-- nullif(…, '') converts an empty string (set by withTransaction for unused
-- scope keys) to NULL so the ::uuid cast never fails and returns no rows.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Shows table — tenant-scoped (template: tenant)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS sample.shows (
  id        UUID NOT NULL PRIMARY KEY,
  tenant_id UUID NOT NULL,
  name      TEXT NOT NULL
);

ALTER TABLE sample.shows ENABLE ROW LEVEL SECURITY;
ALTER TABLE sample.shows FORCE ROW LEVEL SECURITY;

CREATE POLICY shows_tenant ON sample.shows
  AS PERMISSIVE FOR ALL TO app_user
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON sample.shows TO app_user;

-- ---------------------------------------------------------------------------
-- Entries table — hybrid (template: hybrid)
-- Visible to the owning Club (by tenant_id) OR to the submitting exhibitor
-- (by account_id).
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS sample.entries (
  id         UUID NOT NULL PRIMARY KEY,
  tenant_id  UUID NOT NULL,
  account_id UUID NOT NULL,
  show_id    UUID NOT NULL REFERENCES sample.shows(id),
  dog_name   TEXT NOT NULL
);

ALTER TABLE sample.entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE sample.entries FORCE ROW LEVEL SECURITY;

CREATE POLICY entries_hybrid ON sample.entries
  AS PERMISSIVE FOR ALL TO app_user
  USING (
    tenant_id  = nullif(current_setting('app.tenant_id',  true), '')::uuid
    OR account_id = nullif(current_setting('app.account_id', true), '')::uuid
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON sample.entries TO app_user;

-- ---------------------------------------------------------------------------
-- Outbox table — infrastructure (no RLS: the dispatcher is a platform-level
-- background process that reads all pending rows regardless of tenant).
-- app_user needs INSERT for atomic writes during transactions.
-- ON CONFLICT DO NOTHING does not require UPDATE.
-- The dispatcher connects as a privileged role and does not use app_user.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS sample.outbox (
  seq           BIGSERIAL   NOT NULL PRIMARY KEY,
  event_id      UUID        NOT NULL UNIQUE,
  type          TEXT        NOT NULL,
  occurred_at   TIMESTAMPTZ NOT NULL,
  scope         TEXT        NOT NULL,
  tenant_id     UUID,
  account_id    UUID,
  aggregate_id  TEXT        NOT NULL,
  payload       JSONB       NOT NULL,
  dispatched_at TIMESTAMPTZ
);

GRANT SELECT, INSERT, UPDATE ON sample.outbox TO app_user;
GRANT USAGE ON SEQUENCE sample.outbox_seq_seq TO app_user;
