-- SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
-- SPDX-License-Identifier: AGPL-3.0-only

CREATE TABLE IF NOT EXISTS sample_context.dogs (
  id   UUID        NOT NULL PRIMARY KEY,
  name TEXT        NOT NULL
);
