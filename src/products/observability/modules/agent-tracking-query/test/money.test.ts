import { describe, expect, it } from 'vitest';
import { costOf, sumMoney, toNanos, tokensOf } from '../src/lib/money';

describe('money', () => {
  it('keeps sub-cent amounts and never goes through cents', () => {
    expect(toNanos(0.000315)).toBe(315000n);
    expect(toNanos(12.34)).toBe(12340000000n);
    expect(toNanos(0.1 + 0.2)).toBe(300000000n);
    expect(toNanos('1.23456789012345')).toBe(1234567890n);
    expect(toNanos('0.0000000005')).toBe(1n);
    expect(toNanos(0)).toBe(0n);
  });

  it('reads the exponent form Decimal128 writes below a millionth', () => {
    expect(toNanos('1.23E-7')).toBe(123n);
    expect(toNanos('1.230000000E-7')).toBe(123n);
    expect(toNanos('5E-10')).toBe(1n);
    expect(toNanos('4E-10')).toBe(0n);
    expect(toNanos('1.5E+2')).toBe(150000000000n);
    expect(toNanos('-2.5e-3')).toBe(-2500000n);
  });

  it('sums decimal strings without rounding them', () => {
    expect(sumMoney(['0.000000123', 0.1, '1.23E-7'])).toBe(100_000_246n);
    expect(toNanos(sumMoney(['1.5', 2]))).toBe(3_500_000_000n);
    expect(sumMoney([null, 'abc'])).toBeNull();
  });

  it('treats missing and malformed amounts as unknown, not zero', () => {
    expect(toNanos(null)).toBeNull();
    expect(toNanos(undefined)).toBeNull();
    expect(toNanos('abc')).toBeNull();
    expect(toNanos(Number.NaN)).toBeNull();
    expect(toNanos('1E')).toBeNull();
    expect(toNanos('1E-9999')).toBeNull();
  });
});

describe('cost with its basis', () => {
  it('splits a billed part from the estimate', () => {
    let cost = costOf({
      total: 10.5,
      listPrice: 11,
      reported: [
        { unit: 'usd', basis: 'billed', amount: 4 },
        { unit: 'cents', basis: 'billed', amount: 50 },
        { unit: 'usd', basis: 'client_estimate', amount: 9.9 }
      ]
    });

    expect(cost).toEqual({
      totalMicros: 10500000,
      billedMicros: 4500000,
      estimatedMicros: 6000000,
      isEstimate: true,
      reportedByClientMicros: 9900000,
      listPriceMicros: 11000000
    });
  });

  it('rounds to micro-dollars half away from zero', () => {
    let cost = costOf({
      total: '0.0000015',
      listPrice: '-0.0000025',
      reported: [{ unit: 'usd', basis: 'client_estimate', amount: '0.0000014994' }]
    });

    expect(cost).toMatchObject({
      totalMicros: 2,
      reportedByClientMicros: 1,
      listPriceMicros: -3
    });
  });

  it('keeps billed plus estimated equal to total after rounding', () => {
    let cost = costOf({
      total: '0.0000034',
      listPrice: null,
      reported: [{ unit: 'usd', basis: 'billed', amount: '0.0000016' }]
    });

    expect(cost).toMatchObject({ totalMicros: 3, billedMicros: 2, estimatedMicros: 1 });
  });

  it('marks a fully billed total as no estimate', () => {
    let cost = costOf({
      total: '2.25',
      listPrice: null,
      reported: [{ unit: 'usd', basis: 'billed', amount: '2.25' }]
    });

    expect(cost.estimatedMicros).toBe(0);
    expect(cost.isEstimate).toBe(false);
  });

  it('reports the client figure and ignores units that are not money', () => {
    let cost = costOf({
      total: 3,
      listPrice: 3.1,
      reported: [
        { unit: 'usd', basis: 'client_estimate', amount: 3 },
        { unit: 'credits', basis: 'client_estimate', amount: 900 }
      ]
    });

    expect(cost.billedMicros).toBeNull();
    expect(cost.estimatedMicros).toBe(3000000);
    expect(cost.reportedByClientMicros).toBe(3000000);
  });

  it('has no estimate when there is no total', () => {
    expect(costOf({ total: null, listPrice: null, reported: [] })).toEqual({
      totalMicros: null,
      billedMicros: null,
      estimatedMicros: null,
      isEstimate: false,
      reportedByClientMicros: null,
      listPriceMicros: null
    });
  });
});

describe('unpriced usage', () => {
  it('has no total when none of the requests had a cost', () => {
    let cost = costOf({
      total: 0,
      listPrice: 0,
      reported: [],
      unpriced: true,
      unpricedAtListPrice: true
    });

    expect(cost).toMatchObject({
      totalMicros: null,
      estimatedMicros: null,
      isEstimate: false,
      listPriceMicros: null
    });
  });
});

describe('tokens', () => {
  it('maps the engine components and fills the total', () => {
    expect(
      tokensOf({ inputUncached: 10, cacheRead: 5, cacheWrite: 2, output: 3, reasoning: null })
    ).toEqual({ input: 10, cacheRead: 5, cacheWrite: 2, output: 3, reasoning: 0, total: 20 });
    expect(tokensOf(null).total).toBe(0);
  });
});
