-- SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
-- SPDX-License-Identifier: AGPL-3.0-only

-- Announcement table — platform scope (ADR-0005): reference/operator
-- data with no single owner. RLS-exempt.

CREATE TABLE IF NOT EXISTS sample.announcements (
  id    UUID NOT NULL PRIMARY KEY,
  name  TEXT NOT NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON sample.announcements TO app_user;
