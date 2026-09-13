// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { TransactionScope } from '../../../Shared/index.js';
import type { UserRepository } from '../../domain/model/user/user-repository.js';
import type { UserRoleGrantsRepository } from '../../domain/model/user-role-grants/user-role-grants-repository.js';

/**
 * The repositories available inside one IAM unit of work (ADR-0014).
 *
 * Lists repositories only (ADR-0027) — a use case never appends events
 * itself; an aggregate root records its own facts (`this.record(...)`,
 * `AggregateRoot.pullEvents()`) and the unit-of-work implementation pulls and
 * stamps them when a repository's `add`/`update` is called. `User` records no
 * events of its own (there is currently no published fact for
 * registration/login), so only `userRoleGrants`'s `add`/`update` pull events
 * today.
 */
export interface IamUnitOfWorkContext {
    readonly users: UserRepository;
    readonly userRoleGrants: UserRoleGrantsRepository;
}

/**
 * Per-context unit-of-work port (ADR-0014).
 *
 * Opens a transaction scoped to `scope` (setting the RLS session variables),
 * constructs the context's repositories inside it, runs `body`, then commits
 * — atomically writing any recorded domain facts to the outbox before commit
 * (or rolling back on error). Users are platform data (ADR-0005): every IAM
 * use case calls `run` with `PlatformTransactionScope.of()`, not a scope
 * derived from the caller (there is no caller identity yet at the point
 * someone is authenticating).
 *
 * No Postgres implementation exists yet — only the port and
 * `FakeIamUnitOfWork` (`../../infrastructure/persistence/inmemory/fake-iam-unit-of-work.js`).
 */
export interface IamUnitOfWork {
    run<T>(scope: TransactionScope, body: (ctx: IamUnitOfWorkContext) => Promise<T>): Promise<T>;
}
