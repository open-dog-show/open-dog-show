// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Thrown by `PgPollingDispatcher.poll` when a row fails to dispatch — a
 * handler error, a handler-timeout, or a row whose `type` has no registered
 * rehydrator. Carries the row's `seq`, `eventId`, `type`, and the `attempts`
 * count as of this failure, so a caller can tell a routine retry (`attempts`
 * below the dispatcher's `maxAttempts`) from a just-quarantined poison pill
 * (`attempts` at or above it). `attempts` is incremented at claim time —
 * before the handler ever runs — so it is always known by the time a handler
 * failure reaches here, independently of whether the best-effort
 * `last_error` recording below succeeds.
 *
 * The original failure's message is preserved on `cause`; when the
 * best-effort `last_error` recording itself fails, that failure is preserved
 * too — via `cause.recordingError` — rather than silently discarded, so no
 * failure information is lost.
 */
// `recordingError` is caught from a best-effort write and may be anything;
// stringify each primitive kind explicitly rather than falling through to
// Object's default `[object Object]` toString.
function describeUnstringifiedCause(value: unknown): string {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
        return String(value);
    }
    if (value === null || value === undefined) return String(value);
    try {
        // TS's lib types claim `JSON.stringify` always returns `string`, but
        // it returns `undefined` for a function, a bare symbol, or a value
        // whose `toJSON` returns `undefined` — the cast restores that.
        const json = JSON.stringify(value) as string | undefined;
        return json ?? Object.prototype.toString.call(value);
    } catch {
        return Object.prototype.toString.call(value);
    }
}

/**
 * The row-identifying fields a dispatch failure carries — `seq`, `eventId`,
 * `type`, and `attempts` — factored into one type so {@link OutboxDispatchFailed}'s
 * constructor and `PgPollingDispatcher.recordDispatchFailure`'s parameter
 * share it instead of two independently-declared shapes that must be kept in
 * sync by hand (see #210's ticket-review: this is exactly what made the
 * `attempts` type narrowing a three-site manual edit).
 */
export interface OutboxRowFailureContext {
    readonly seq: string;
    readonly eventId: string;
    readonly type: string;
    readonly attempts: number;
}

export class OutboxDispatchFailed extends Error {
    readonly seq: string;
    readonly eventId: string;
    readonly type: string;
    readonly attempts: number;

    constructor(
        params: OutboxRowFailureContext & {
            readonly cause: unknown;
            readonly recordingError?: unknown;
        },
    ) {
        super(
            `Outbox dispatch failed for event '${params.eventId}' (type '${params.type}', attempt ${String(params.attempts)})`,
            {
                cause: {
                    error:
                        params.cause instanceof Error ? params.cause.message : String(params.cause),
                    recordingError:
                        params.recordingError === undefined
                            ? undefined
                            : params.recordingError instanceof Error
                              ? params.recordingError.message
                              : describeUnstringifiedCause(params.recordingError),
                },
            },
        );
        this.name = 'OutboxDispatchFailed';
        this.seq = params.seq;
        this.eventId = params.eventId;
        this.type = params.type;
        this.attempts = params.attempts;
    }
}
