import { describe, expect, it } from 'vitest';
import {
  priceAssumedAfterMs,
  pricePeriodAt,
  pricePeriodTimeline,
  type PricePeriod
} from '@mtsrc/agent-tracking-model-resolver';
import { pricing } from './fixtures';

let day = 24 * 60 * 60 * 1000;

let at = (value: string) => new Date(value);

let pricePeriod = (
  id: string,
  d: {
    from: string;
    to?: string;
    confirmed?: string;
    input?: number;
    closeReason?: PricePeriod['closeReason'];
  }
): PricePeriod => ({
  id,
  pricing: pricing(d.input ?? 1),
  origin: 'observed',
  closeReason: d.closeReason ?? (d.to ? 'changed' : null),
  validFrom: at(d.from),
  validTo: d.to ? at(d.to) : null,
  confirmedAt: at(d.confirmed ?? d.to ?? d.from)
});

let lookup = (periods: PricePeriod[], time: string) => {
  let match = pricePeriodAt(pricePeriodTimeline(periods), at(time));
  return match ? [match.period.id, match.priceAssumed] : null;
};

describe('pricePeriodAt', () => {
  let a = pricePeriod('a', { from: '2026-01-01T00:00:00Z', to: '2026-02-01T00:00:00Z' });
  let b = pricePeriod('b', {
    from: '2026-02-01T00:00:00Z',
    to: '2026-03-01T00:00:00Z',
    input: 2
  });
  let aAgain = pricePeriod('a2', {
    from: '2026-03-01T00:00:00Z',
    confirmed: '2026-04-01T00:00:00Z'
  });
  let history = [aAgain, a, b];

  it.each([
    ['before the first period', '2025-12-31T23:59:59Z', ['a', true]],
    ['at validFrom (inclusive)', '2026-01-01T00:00:00Z', ['a', false]],
    ['inside the first period', '2026-01-15T00:00:00Z', ['a', false]],
    ['just before validTo', '2026-01-31T23:59:59.999Z', ['a', false]],
    ['at validTo (exclusive), in the next period', '2026-02-01T00:00:00Z', ['b', false]],
    ['back to the first price (A→B→A)', '2026-03-01T00:00:00Z', ['a2', false]],
    ['in the open period before its confirmation', '2026-03-15T00:00:00Z', ['a2', false]],
    ['exactly 7 days after confirmation', '2026-04-08T00:00:00Z', ['a2', false]],
    ['just over 7 days after confirmation', '2026-04-08T00:00:00.001Z', ['a2', true]],
    ['months after confirmation', '2026-09-01T00:00:00Z', ['a2', true]]
  ])('%s', (_, time, expected) => {
    expect(lookup(history, time)).toEqual(expected);
  });

  it('uses the configured 7-day window', () => {
    expect(priceAssumedAfterMs).toBe(7 * day);
  });

  it('has no price inside a gap left by a correction', () => {
    let ended = pricePeriod('ended', {
      from: '2026-01-01T00:00:00Z',
      to: '2026-02-01T00:00:00Z',
      closeReason: 'corrected'
    });
    let resumed = pricePeriod('resumed', { from: '2026-03-01T00:00:00Z' });

    expect(lookup([ended, resumed], '2026-01-20T00:00:00Z')).toEqual(['ended', false]);
    expect(lookup([ended, resumed], '2026-02-15T00:00:00Z')).toBeNull();
    expect(lookup([ended, resumed], '2026-03-01T00:00:00Z')).toEqual(['resumed', false]);
    expect(lookup([ended], '2026-05-01T00:00:00Z')).toBeNull();
  });

  it('has no price without periods', () => {
    expect(lookup([], '2026-01-01T00:00:00Z')).toBeNull();
  });

  it('finds the right period in a long timeline', () => {
    let periods = Array.from({ length: 50 }, (_, index) =>
      pricePeriod(`p${index}`, {
        from: new Date(Date.UTC(2026, 0, 1) + index * day).toISOString(),
        to: new Date(Date.UTC(2026, 0, 1) + (index + 1) * day).toISOString()
      })
    );

    for (let index of [0, 1, 17, 48, 49]) {
      let time = new Date(Date.UTC(2026, 0, 1) + index * day + 1000).toISOString();
      expect(lookup(periods, time)).toEqual([`p${index}`, false]);
    }
  });
});

describe('pricePeriodTimeline', () => {
  it('sorts by validFrom and drops empty periods', () => {
    let periods = [
      pricePeriod('late', { from: '2026-03-01T00:00:00Z' }),
      pricePeriod('empty', {
        from: '2026-02-01T00:00:00Z',
        to: '2026-02-01T00:00:00Z',
        closeReason: 'corrected'
      }),
      pricePeriod('early', { from: '2026-01-01T00:00:00Z', to: '2026-03-01T00:00:00Z' })
    ];

    expect(pricePeriodTimeline(periods).map(period => period.id)).toEqual(['early', 'late']);
  });
});
