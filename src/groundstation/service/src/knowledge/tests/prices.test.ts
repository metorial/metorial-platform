import type { Offering, Pricing } from '@metorial/model-catalog/src/types';
import { describe, expect, it } from 'vitest';
import {
  confirmIntervalMs,
  planPriceChanges,
  type OpenPricePeriod,
  type PricePlan
} from '../prices';
import { pricingHashOf, type KnowledgeRow } from '../rows';
import { offering, pricing, range } from './fixtures';

let hour = 60 * 60 * 1000;
let start = Date.parse('2026-01-01T00:00:00.000Z');
let at = (hours: number) => new Date(start + hours * hour);
let firstSeen = at(-100);

let priceA = pricing(1);
let priceB = pricing(2);

let row = (id: string, extra: Partial<Offering> = {}): KnowledgeRow => ({
  id,
  columns: {},
  data: offering(id, { firstSeenAt: firstSeen.toISOString(), ...extra }) as unknown as Record<
    string,
    unknown
  >,
  contentHash: ''
});

let openPeriod = (d: {
  pricing: Pricing;
  validFrom?: Date;
  confirmedAt?: Date;
}): OpenPricePeriod => ({
  oid: 100n,
  offeringOid: 1n,
  pricingHash: pricingHashOf(d.pricing)!,
  validFrom: d.validFrom ?? at(-48),
  confirmedAt: d.confirmedAt ?? at(-1)
});

let opened = (price: Pricing, origin: 'bootstrap' | 'observed', validFrom: Date) => ({
  offeringOid: 1n,
  vendorId: 'vendor',
  modelId: 'model',
  pricing: price,
  pricingHash: pricingHashOf(price)!,
  origin,
  validFrom
});

let empty: PricePlan = { open: [], close: [], confirm: [] };

type Case = {
  name: string;
  rows: KnowledgeRow[];
  open?: OpenPricePeriod;
  added?: string[];
  bootstrap?: boolean;
  oids?: Map<string, bigint>;
  expected: PricePlan;
};

let cases: Case[] = [
  {
    name: 'bootstrap opens from firstSeenAt',
    rows: [row('o')],
    bootstrap: true,
    expected: { ...empty, open: [opened(priceA, 'bootstrap', firstSeen)] }
  },
  {
    name: 'bootstrap never opens after generatedAt',
    rows: [row('o', { firstSeenAt: at(5).toISOString() })],
    bootstrap: true,
    expected: { ...empty, open: [opened(priceA, 'bootstrap', at(0))] }
  },
  {
    name: 'bootstrap without firstSeenAt opens at generatedAt',
    rows: [row('o', { firstSeenAt: undefined })],
    bootstrap: true,
    expected: { ...empty, open: [opened(priceA, 'bootstrap', at(0))] }
  },
  {
    name: 'an added offering opens from firstSeenAt',
    rows: [row('o')],
    added: ['o'],
    expected: { ...empty, open: [opened(priceA, 'observed', firstSeen)] }
  },
  {
    name: 'a known offering that gains a price opens at generatedAt',
    rows: [row('o')],
    expected: { ...empty, open: [opened(priceA, 'observed', at(0))] }
  },
  {
    name: 'an unpriced offering opens nothing',
    rows: [row('o', { pricing: null })],
    added: ['o'],
    bootstrap: true,
    expected: empty
  },
  {
    name: 'the same price recently confirmed does nothing',
    rows: [row('o')],
    open: openPeriod({
      pricing: priceA,
      confirmedAt: new Date(at(0).getTime() - confirmIntervalMs + 1)
    }),
    expected: empty
  },
  {
    name: 'the same price confirmed long enough ago is confirmed',
    rows: [row('o')],
    open: openPeriod({
      pricing: priceA,
      confirmedAt: new Date(at(0).getTime() - confirmIntervalMs)
    }),
    expected: { ...empty, confirm: [100n] }
  },
  {
    name: 'a different price closes and reopens at generatedAt',
    rows: [row('o', { pricing: priceB })],
    open: openPeriod({ pricing: priceA }),
    expected: {
      ...empty,
      close: [{ oid: 100n, validTo: at(0) }],
      open: [opened(priceB, 'observed', at(0))]
    }
  },
  {
    name: 'a different price never closes before the open period starts',
    rows: [row('o', { pricing: priceB })],
    open: openPeriod({ pricing: priceA, validFrom: at(3) }),
    expected: {
      ...empty,
      close: [{ oid: 100n, validTo: at(3) }],
      open: [opened(priceB, 'observed', at(3))]
    }
  },
  {
    name: 'a different price during bootstrap still opens an observed period',
    rows: [row('o', { pricing: priceB })],
    open: openPeriod({ pricing: priceA }),
    bootstrap: true,
    expected: {
      ...empty,
      close: [{ oid: 100n, validTo: at(0) }],
      open: [opened(priceB, 'observed', at(0))]
    }
  },
  {
    name: 'a null price keeps the open period',
    rows: [row('o', { pricing: null })],
    open: openPeriod({ pricing: priceA, confirmedAt: at(-100) }),
    expected: empty
  },
  {
    name: 'a missing offering keeps the open period',
    rows: [],
    open: openPeriod({ pricing: priceA, confirmedAt: at(-100) }),
    expected: empty
  },
  {
    name: 'a retired offering with the same price keeps the open period',
    rows: [row('o', { status: 'retired' })],
    open: openPeriod({ pricing: priceA }),
    expected: empty
  },
  {
    name: 'an offering without an oid is skipped',
    rows: [row('o', { pricing: priceB })],
    open: openPeriod({ pricing: priceA }),
    oids: new Map(),
    expected: empty
  }
];

describe('planPriceChanges', () => {
  it.each(cases)('$name', testCase => {
    let plan = planPriceChanges({
      offerings: testCase.rows,
      offeringOids: testCase.oids ?? new Map([['o', 1n]]),
      addedIds: new Set(testCase.added ?? []),
      openPeriods: new Map(testCase.open ? [[testCase.open.offeringOid, testCase.open]] : []),
      generatedAt: at(0),
      bootstrap: testCase.bootstrap ?? false
    });

    expect(plan).toEqual(testCase.expected);
  });
});

type SimulatedPeriod = OpenPricePeriod & { validTo: Date | null };

type Snapshot = { generatedAt: Date; rows: KnowledgeRow[] };

let createLedger = () => {
  let periods: SimulatedPeriod[] = [];
  let seen = new Set<string>();
  let oids = new Map<string, bigint>();
  let nextOid = 1000n;
  let snapshots = 0;

  let openPeriods = () =>
    new Map(
      periods
        .filter(item => !item.validTo)
        .map(({ validTo: _validTo, ...item }) => [item.offeringOid, item])
    );

  let plan = (snapshot: Snapshot) => {
    for (let item of snapshot.rows)
      if (!oids.has(item.id)) oids.set(item.id, BigInt(oids.size + 1));

    return planPriceChanges({
      offerings: snapshot.rows,
      offeringOids: oids,
      addedIds: new Set(snapshot.rows.map(item => item.id).filter(id => !seen.has(id))),
      openPeriods: openPeriods(),
      generatedAt: snapshot.generatedAt,
      bootstrap: snapshots == 0
    });
  };

  let apply = (snapshot: Snapshot) => {
    let result = plan(snapshot);

    for (let close of result.close)
      periods.find(item => item.oid == close.oid)!.validTo = close.validTo;
    for (let open of result.open) {
      periods.push({
        oid: nextOid++,
        offeringOid: open.offeringOid,
        pricingHash: open.pricingHash,
        validFrom: open.validFrom,
        validTo: null,
        confirmedAt: snapshot.generatedAt
      });
    }
    for (let oid of result.confirm)
      periods.find(item => item.oid == oid)!.confirmedAt = snapshot.generatedAt;

    for (let item of snapshot.rows) seen.add(item.id);
    snapshots++;

    return result;
  };

  let periodsOf = (id: string) =>
    periods
      .filter(item => item.offeringOid == oids.get(id))
      .sort((a, b) => (a.oid < b.oid ? -1 : 1));

  return { plan, apply, periodsOf };
};

let snapshotOf = (hours: number, prices: (Pricing | null)[]) => ({
  generatedAt: at(hours),
  rows: prices.map((price, index) => row(`o${index}`, { pricing: price }))
});

describe('planPriceChanges over a sequence of snapshots', () => {
  it('keeps three periods for A then B then A', () => {
    let ledger = createLedger();

    ledger.apply(snapshotOf(0, [priceA]));
    ledger.apply(snapshotOf(24, [priceB]));
    ledger.apply(snapshotOf(48, [priceA]));

    expect(
      ledger.periodsOf('o0').map(item => [item.pricingHash, item.validFrom, item.validTo])
    ).toEqual([
      [pricingHashOf(priceA), firstSeen, at(24)],
      [pricingHashOf(priceB), at(24), at(48)],
      [pricingHashOf(priceA), at(48), null]
    ]);
  });

  it('keeps a single period for A then null then A', () => {
    let ledger = createLedger();

    ledger.apply(snapshotOf(0, [priceA]));
    ledger.apply(snapshotOf(24, [null]));
    ledger.apply(snapshotOf(48, [priceA]));

    expect(ledger.periodsOf('o0')).toEqual([
      expect.objectContaining({
        pricingHash: pricingHashOf(priceA),
        validFrom: firstSeen,
        validTo: null
      })
    ]);
  });

  it('changes nothing when the same snapshot is applied twice', () => {
    let ledger = createLedger();
    let snapshot = snapshotOf(0, [priceA, priceB, null]);

    ledger.apply(snapshot);

    expect(ledger.plan(snapshot)).toEqual(empty);
  });

  // mulberry32
  let seeded = (seed: number) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };

  let pool = [pricing(1), pricing(2), pricing(3), null];
  let ids = ['a', 'b', 'c'];

  it.each(range(25).map(seed => [seed]))('holds the period invariants for seed %i', seed => {
    let random = seeded(seed);
    let pick = <T>(items: T[]) => items[Math.floor(random() * items.length)]!;
    let ledger = createLedger();
    let observed = new Map<string, string[]>();
    let hours = 0;

    for (let step = 0; step < 40; step++) {
      hours += 1 + Math.floor(random() * 30);

      let rows = ids
        .filter(() => random() < 0.8)
        .map(id =>
          row(id, { pricing: pick(pool), status: random() < 0.1 ? 'retired' : 'active' })
        );
      let snapshot = { generatedAt: at(hours), rows };

      ledger.apply(snapshot);

      expect(ledger.plan(snapshot)).toEqual(empty);

      for (let item of rows) {
        let hash = pricingHashOf((item.data as unknown as Offering).pricing);
        let history = observed.get(item.id) ?? [];

        if (hash && history.at(-1) != hash) observed.set(item.id, [...history, hash]);
      }

      for (let id of ids) {
        let periods = ledger.periodsOf(id);
        let open = periods.filter(item => !item.validTo);

        expect(open.length).toBeLessThanOrEqual(1);
        expect(periods.map(item => item.pricingHash)).toEqual(observed.get(id) ?? []);
        if (periods.length) expect(periods.at(-1)!.validTo).toBeNull();

        for (let index = 1; index < periods.length; index++) {
          let previous = periods[index - 1]!;
          let current = periods[index]!;

          expect(previous.validTo).not.toBeNull();
          expect(previous.validTo!.getTime()).toBeGreaterThanOrEqual(
            previous.validFrom.getTime()
          );
          expect(previous.validTo!.getTime()).toBeLessThanOrEqual(current.validFrom.getTime());
        }
      }
    }
  });
});
