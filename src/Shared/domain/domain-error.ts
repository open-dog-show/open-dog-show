// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Base class for domain errors — rule violations a caller can meaningfully
 * handle and that are part of the domain vocabulary (E4).
 *
 * Conventions enforced here:
 * - **One subclass per handling decision** (E2): the type is what the boundary
 *   switches on, not the message.
 * - **Context travels in the `context` bag** (E5, L4): the boundary handler
 *   logs once at the catch using `error.context` plus `error.message`, without
 *   reaching into subclass-specific fields.
 * - **`name` is set to the concrete subclass name** via `new.target`, so both
 *   `instanceof SubError` discrimination and `error.name === 'SubError'` work
 *   without each subclass re-assigning it.
 * - **No outer-layer imports** (E3): this base extends `Error` only; domain
 *   errors never carry a third-party/infrastructure exception type.
 *
 * Expected business outcomes the immediate caller must branch on travel as a
 * `Result<T, E extends DomainError>` on the use-case output (E1); bugs and
 * technical faults stay thrown to the outermost handler. Technical/infrastructure
 * errors (persistence failures, I/O faults) do **not** extend this base — they
 * are translated at the infrastructure boundary into their own `Error`
 * subclasses and handled generically.
 */
export abstract class DomainError extends Error {
    readonly context: Readonly<Record<string, unknown>>;

    constructor(message: string, context: Readonly<Record<string, unknown>> = {}) {
        super(message);
        this.name = new.target.name;
        this.context = context;
    }
}
