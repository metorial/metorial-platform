import { describe, expect, it } from 'vitest';
import { costOf, formatMoney, toNanos, tokensOf } from '../src/lib/money';

describe('money', () => {
  it('keeps sub-cent amounts and never goes through cents', () => {
    expect(formatMoney(0.000315)).toBe('0.000315');
    expect(formatMoney(12.34)).toBe('12.34');
    expect(formatMoney(0.1 + 0.2)).toBe('0.3');
    expect(formatMoney('1.23456789012345')).toBe('1.23456789');
    expect(formatMoney('0.0000000005')).toBe('0.000000001');
    expect(formatMoney(0)).toBe('0');
  });

  it('reads the exponent form Decimal128 writes below a millionth', () => {
    expect(formatMoney('1.23E-7')).toBe('0.000000123');
    expect(formatMoney('1.230000000E-7')).toBe('0.000000123');
    expect(formatMoney('5E-10')).toBe('0.000000001');
    expect(formatMoney('4E-10')).toBe('0');
    expect(formatMoney('1.5E+2')).toBe('150');
    expect(formatMoney('-2.5e-3')).toBe('-0.0025');
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
      total: '10.5',
      billed: '4.5',
      estimated: '6',
      isEstimate: true,
      reportedByClient: '9.9',
      listPrice: '11'
    });
  });

  it('marks a fully billed total as no estimate', () => {
    let cost = costOf({
      total: '2.25',
      listPrice: null,
      reported: [{ unit: 'usd', basis: 'billed', amount: '2.25' }]
    });

    expect(cost.estimated).toBe('0');
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

    expect(cost.billed).toBeNull();
    expect(cost.estimated).toBe('3');
    expect(cost.reportedByClient).toBe('3');
  });

  it('has no estimate when there is no total', () => {
    expect(costOf({ total: null, listPrice: null, reported: [] })).toEqual({
      total: null,
      billed: null,
      estimated: null,
      isEstimate: false,
      reportedByClient: null,
      listPrice: null
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
      total: null,
      estimated: null,
      isEstimate: false,
      listPrice: null
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
