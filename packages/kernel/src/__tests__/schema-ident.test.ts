// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from 'vitest';
import { quoteSchemaIdent } from '../infrastructure/schema-ident.js';

describe('quoteSchemaIdent', () => {
    it('wraps a simple schema name in double quotes', () => {
        expect(quoteSchemaIdent('sample')).toBe('"sample"');
    });

    it('doubles embedded double quotes to prevent SQL injection', () => {
        expect(quoteSchemaIdent('sa"mple')).toBe('"sa""mple"');
    });

    it('doubles every embedded double quote', () => {
        expect(quoteSchemaIdent('a""b')).toBe('"a""""b"');
    });
});
