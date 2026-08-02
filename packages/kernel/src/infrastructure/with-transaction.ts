// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type pg from 'pg';
import type { TransactionScope } from '../domain/transaction-scope.js';

/**
 * Opens a PostgreSQL transaction, sets the RLS session variables from `scope`,
 * runs `fn`, then commits (or rolls back on error).
 *
 * Session variables set per transaction:
 *   - `app.tenant_id`  — UUID string, or empty string when not applicable.
 *   - `app.account_id` — UUID string, or empty string when not applicable.
 *
 * RLS policies read them via `nullif(current_setting('app.tenant_id', true), '')::uuid`
 * so an empty string safely evaluates to NULL (= no rows match the policy predicate).
 */
export async function withTransaction<T>(
    pool: pg.Pool,
    scope: TransactionScope,
    fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const tenantId = scope.kind === 'tenant' ? scope.tenantId : '';
        const accountId = scope.kind !== 'platform' ? scope.accountId : '';

        // set_config(setting, value, is_local=true) is equivalent to SET LOCAL
        // and accepts parameterised values, preventing any injection.
        await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [tenantId]);
        await client.query(`SELECT set_config('app.account_id', $1, true)`, [accountId]);

        const result = await fn(client);
        await client.query('COMMIT');
        return result;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}
