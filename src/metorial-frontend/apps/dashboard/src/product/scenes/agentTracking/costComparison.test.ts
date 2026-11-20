import { describe, expect, it } from 'vitest';
import { describeCostComparison } from './costComparison';

let format = (amount: string) => `~$${Number(amount).toFixed(2)}`;

describe('describeCostComparison', () => {
  it('says the list price covers every request when it does', () => {
    expect(
      describeCostComparison({
        reportedByClient: '3.74',
        listPrice: '3.70',
        requests: 73,
        requestsWithoutListPrice: 0,
        format
      })
    ).toBe(
      'For comparison: Claude Code reported ~$3.74. Metorial at list prices: ~$3.70, for all 73 requests. Comparison figures are never added to the total.'
    );
  });

  it('names the single request a full list price covers', () => {
    expect(
      describeCostComparison({
        reportedByClient: null,
        listPrice: '0.5',
        requests: 1,
        requestsWithoutListPrice: 0,
        format
      })
    ).toBe(
      'For comparison: Metorial at list prices: ~$0.50, for the one request. Comparison figures are never added to the total.'
    );
  });

  it('says how much of the usage a partial list price covers', () => {
    expect(
      describeCostComparison({
        reportedByClient: '3.74',
        listPrice: '0.27',
        requests: 73,
        requestsWithoutListPrice: 56,
        format
      })
    ).toBe(
      'For comparison: Claude Code reported ~$3.74. Metorial at list prices: ~$0.27, for 17 of 73 requests; the other 56 have no list price. Comparison figures are never added to the total.'
    );
  });

  it('uses the singular for one request without a list price', () => {
    expect(
      describeCostComparison({
        reportedByClient: null,
        listPrice: '1.5',
        requests: 3,
        requestsWithoutListPrice: 1,
        format
      })
    ).toBe(
      'For comparison: Metorial at list prices: ~$1.50, for 2 of 3 requests; the other 1 has no list price. Comparison figures are never added to the total.'
    );
  });

  it('gives no list-price figure when no request has one', () => {
    expect(
      describeCostComparison({
        reportedByClient: '0.12',
        listPrice: null,
        requests: 4,
        requestsWithoutListPrice: 4,
        format
      })
    ).toBe(
      'For comparison: Claude Code reported ~$0.12. None of the 4 requests has a list price. Comparison figures are never added to the total.'
    );

    expect(
      describeCostComparison({
        reportedByClient: null,
        listPrice: null,
        requests: 1,
        requestsWithoutListPrice: 1,
        format
      })
    ).toBe(
      'For comparison: The request has no list price. Comparison figures are never added to the total.'
    );
  });

  it('has nothing to compare without requests', () => {
    expect(
      describeCostComparison({
        reportedByClient: '0',
        listPrice: '0',
        requests: 0,
        requestsWithoutListPrice: 0,
        format
      })
    ).toBeNull();
  });
});
