// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: [
            'packages/*/src/**/*.integration.test.ts',
            'packages/contexts/*/src/**/*.integration.test.ts',
        ],
        testTimeout: 120_000,
    },
});
