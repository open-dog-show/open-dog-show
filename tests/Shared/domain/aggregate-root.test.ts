// SPDX-FileCopyrightText: 2026 the OpenDogShow contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from 'vitest';
import {
    AggregateRoot,
    asAggregateId,
    ClubEventScope,
    asClubId,
    asEventType,
    type DomainEventFact,
} from '../../../src/Shared/index.js';

const AGGREGATE_ID = asAggregateId('order-1');
const CLUB_ID = asClubId('00000000-0000-4000-8000-000000000001');
const FACT_TYPE = asEventType('sample.ThingHappened');

class ThingHappened implements DomainEventFact {
    readonly type = FACT_TYPE;
    constructor(
        readonly aggregateId: DomainEventFact['aggregateId'],
        readonly scope: DomainEventFact['scope'],
        readonly payload: unknown,
    ) {}
}

class Order extends AggregateRoot {
    recordThing(payload: unknown): void {
        this.record(new ThingHappened(AGGREGATE_ID, ClubEventScope.of(CLUB_ID), payload));
    }
}

describe('AggregateRoot', () => {
    it('pullEvents returns an empty array when nothing was recorded', () => {
        const order = new Order();
        expect(order.pullEvents()).toEqual([]);
    });

    it('pullEvents returns every fact recorded since construction, in order', () => {
        const order = new Order();
        order.recordThing({ n: 1 });
        order.recordThing({ n: 2 });

        const facts = order.pullEvents();

        expect(facts).toHaveLength(2);
        expect(facts[0]).toBeInstanceOf(ThingHappened);
        expect(facts[0]?.payload).toStrictEqual({ n: 1 });
        expect(facts[1]?.payload).toStrictEqual({ n: 2 });
    });

    it('clears the buffer after pullEvents — a second call returns nothing new', () => {
        const order = new Order();
        order.recordThing({ n: 1 });

        order.pullEvents();
        expect(order.pullEvents()).toEqual([]);
    });

    it('accumulates further facts recorded after a previous pullEvents call', () => {
        const order = new Order();
        order.recordThing({ n: 1 });
        order.pullEvents();

        order.recordThing({ n: 2 });
        const facts = order.pullEvents();

        expect(facts).toHaveLength(1);
        expect(facts[0]?.payload).toStrictEqual({ n: 2 });
    });
});
