import { describe, expect, it } from 'vitest';
import { UsageError } from '../../src/lib/safety';
import { createFakeClock } from '../fakeClock';
import { createPacer, parseRates, retryDelayMs } from '../../src/load/rate';

describe('pacer', () => {
  it('schedules batches so records arrive at the target rate', async () => {
    let clock = createFakeClock(1_000);
    let pacer = createPacer({ ratePerSecond: 100, startAt: 1_000, clock });
    let slots = [];

    for (let index = 0; index < 50; index++) slots.push(await pacer.take(10));

    expect(slots[0]!.scheduledAt).toBe(1_000);
    expect(slots[1]!.scheduledAt).toBe(1_100);
    expect(slots[49]!.scheduledAt).toBe(1_000 + 49 * 100);
    expect(clock.now()).toBe(1_000 + 49 * 100);
  });

  it('reports lag instead of slowing down when the sender falls behind', async () => {
    let clock = createFakeClock(0);
    let pacer = createPacer({ ratePerSecond: 10, startAt: 0, clock });

    await pacer.take(1);
    clock.advance(500);
    let late = await pacer.take(1);

    expect(late.scheduledAt).toBe(100);
    expect(clock.now() - late.scheduledAt).toBe(400);
    expect(pacer.nextAt()).toBe(200);
  });
});

describe('rate steps', () => {
  it('parses explicit rates', () => {
    expect(parseRates({ rates: ['100', '250.5'] })).toEqual([100, 250.5]);
  });

  it('parses linear and geometric ramps', () => {
    expect(parseRates({ ramp: '100:400:100' })).toEqual([100, 200, 300, 400]);
    expect(parseRates({ ramp: '250:4000:x2' })).toEqual([250, 500, 1000, 2000, 4000]);
  });

  it('rejects bad input', () => {
    expect(() => parseRates({})).toThrow(UsageError);
    expect(() => parseRates({ rates: ['1'], ramp: '1:2:1' })).toThrow(UsageError);
    expect(() => parseRates({ ramp: '100:50' })).toThrow(UsageError);
    expect(() => parseRates({ ramp: '100:400:x1' })).toThrow(UsageError);
    expect(() => parseRates({ rates: ['-5'] })).toThrow(UsageError);
  });
});

describe('retry delay', () => {
  it('honours Retry-After in seconds and as a date, capped', () => {
    let now = Date.parse('2026-11-18T12:00:00Z');

    expect(retryDelayMs({ retryAfter: '5', attempt: 0, now, jitter: 0, maxMs: 30_000 })).toBe(
      5_000
    );
    expect(
      retryDelayMs({ retryAfter: '120', attempt: 0, now, jitter: 0, maxMs: 30_000 })
    ).toBe(30_000);
    expect(
      retryDelayMs({
        retryAfter: 'Wed, 18 Nov 2026 12:00:03 GMT',
        attempt: 0,
        now,
        jitter: 0,
        maxMs: 30_000
      })
    ).toBe(3_000);
  });

  it('backs off exponentially with jitter without a header', () => {
    expect(
      retryDelayMs({ retryAfter: null, attempt: 0, now: 0, jitter: 1, maxMs: 30_000 })
    ).toBe(1_000);
    expect(
      retryDelayMs({ retryAfter: null, attempt: 3, now: 0, jitter: 0, maxMs: 30_000 })
    ).toBe(4_000);
    expect(
      retryDelayMs({ retryAfter: null, attempt: 10, now: 0, jitter: 1, maxMs: 30_000 })
    ).toBe(30_000);
  });
});
