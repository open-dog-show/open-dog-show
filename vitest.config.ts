// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: [
            'packages/*/src/**/*.test.ts',
            'packages/contexts/*/src/**/*.test.ts',
            'scripts/__tests__/**/*.test.ts',
        ],
        exclude: ['**/*.integration.test.ts'],
    },
});
