// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';
import unicorn from 'eslint-plugin-unicorn';

export default tseslint.config(
    { ignores: ['**/node_modules/**', '**/dist/**'] },
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    {
        plugins: { unicorn },
        rules: {
            'unicorn/filename-case': ['error', { case: 'kebabCase', checkDirectories: false }],
        },
    },
    prettierConfig,
);
