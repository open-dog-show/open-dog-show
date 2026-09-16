// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { UnitOfWorkGate } from '../../../src/Shared/infrastructure/unit-of-work-gate.js';

describe('UnitOfWorkGate', () => {
    it('assertOpen does not throw before close() is called', () => {
        const gate = new UnitOfWorkGate(
            (aggregate, operation) => new Error(`${aggregate}.${operation}`),
        );

        expect(() => {
            gate.assertOpen('Item', 'findById');
        }).not.toThrow();
    });

    it('assertOpen throws the built error, naming the aggregate and operation, after close()', () => {
        const gate = new UnitOfWorkGate(
            (aggregate, operation) => new Error(`closed: ${aggregate}.${operation}`),
        );
        gate.close();

        expect(() => {
            gate.assertOpen('Ticket', 'add');
        }).toThrow('closed: Ticket.add');
    });

    it('passes the exact aggregate/operation strings through to the error factory, per call', () => {
        const calls: { aggregate: string; operation: string }[] = [];
        const gate = new UnitOfWorkGate((aggregate, operation) => {
            calls.push({ aggregate, operation });
            return new Error('closed');
        });
        gate.close();

        expect(() => {
            gate.assertOpen('Note', 'update');
        }).toThrow();
        expect(() => {
            gate.assertOpen('Announcement', 'findById');
        }).toThrow();
        expect(calls).toEqual([
            { aggregate: 'Note', operation: 'update' },
            { aggregate: 'Announcement', operation: 'findById' },
        ]);
    });

    it('close() is idempotent — calling it more than once does not throw or change behaviour', () => {
        const gate = new UnitOfWorkGate(() => new Error('closed'));
        gate.close();
        gate.close();

        expect(() => {
            gate.assertOpen('Item', 'findById');
        }).toThrow();
    });
});
