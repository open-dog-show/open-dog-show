// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Thrown by `PgPollingDispatcher.poll` when a row fails to dispatch — a
 * handler error, or a row whose `type` has no registered rehydrator. Carries
 * the row's `seq`, `eventId`, `type`, and the `attempts` count after this
 * failure was recorded, so a caller can tell a routine retry (`attempts`
 * below the dispatcher's `maxAttempts`) from a just-quarantined poison pill
 * (`attempts` at or above it).
 *
 * The original failure's message is preserved on `cause`; when the
 * best-effort `attempts`/`last_error` recording itself fails, that failure is
 * preserved too — via `cause.recordingError` — rather than silently
 * discarded, so no failure information is lost.
 */
export class OutboxDispatchFailed extends Error {
    readonly seq: string;
    readonly eventId: string;
    readonly type: string;
    readonly attempts: number;

    constructor(params: {
        readonly seq: string;
        readonly eventId: string;
        readonly type: string;
        readonly attempts: number;
        readonly cause: unknown;
        readonly recordingError?: unknown;
    }) {
        super(
            `Outbox dispatch failed for event '${params.eventId}' (type '${params.type}', attempt ${params.attempts})`,
            {
                cause: {
                    error:
                        params.cause instanceof Error ? params.cause.message : String(params.cause),
                    recordingError:
                        params.recordingError === undefined
                            ? undefined
                            : params.recordingError instanceof Error
                              ? params.recordingError.message
                              : String(params.recordingError),
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
