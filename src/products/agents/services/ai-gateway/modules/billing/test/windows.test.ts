import { describe, expect, it } from 'vitest';
import { billingWindowMs, billingWindowOf, toMicroUsd, toNanoUsd } from '../src/lib/windows';

describe('billingWindowOf', () => {
  it('aligns five-minute windows to the epoch', () => {
    let window = billingWindowOf(new Date('2026-11-20T15:07:42.123Z'));

    expect(window.start.toISOString()).toBe('2026-11-20T15:05:00.000Z');
    expect(window.end.toISOString()).toBe('2026-11-20T15:10:00.000Z');
    expect(window.end.getTime() - window.start.getTime()).toBe(billingWindowMs);
  });

  it('starts a new window exactly on the boundary', () => {
    expect(billingWindowOf(new Date('2026-11-20T15:10:00.000Z')).start.toISOString()).toBe(
      '2026-11-20T15:10:00.000Z'
    );
    expect(billingWindowOf(new Date('2026-11-20T15:09:59.999Z')).start.toISOString()).toBe(
      '2026-11-20T15:05:00.000Z'
    );
  });
});

describe('toNanoUsd', () => {
  it('converts dollars to whole nano-dollars', () => {
    expect(toNanoUsd(1)).toBe(1_000_000_000n);
    expect(toNanoUsd(0.000018)).toBe(18_000n);
    expect(toNanoUsd(0.0000000004)).toBe(0n);
    expect(toNanoUsd(0.0000000006)).toBe(1n);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('ignores %s', usd => {
    expect(toNanoUsd(usd)).toBe(0n);
  });
});

describe('toMicroUsd', () => {
  it('rounds nano-dollars to the nearest micro-dollar', () => {
    expect(toMicroUsd(0n)).toBe(0);
    expect(toMicroUsd(499n)).toBe(0);
    expect(toMicroUsd(500n)).toBe(1);
    expect(toMicroUsd(1_234_567_890n)).toBe(1_234_568);
  });

  it('rounds the running total, so summing small charges does not drift', () => {
    let total = 0n;
    for (let i = 0; i < 1000; i++) total += toNanoUsd(0.0000004);

    expect(toMicroUsd(total)).toBe(400);
  });
});
