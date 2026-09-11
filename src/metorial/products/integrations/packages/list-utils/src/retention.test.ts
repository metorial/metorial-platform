import { describe, expect, it } from 'vitest';
import {
  getConnectionRetentionFilter,
  getRetentionCutoffDate,
  getSessionRetentionFilter,
  mergeRetentionWithDateFilter
} from './retention';

describe('retention', () => {
  it('clamps negative retention to now', () => {
    let before = Date.now();
    let cutoff = getRetentionCutoffDate(-5);
    let after = Date.now();

    expect(cutoff.getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(cutoff.getTime()).toBeLessThanOrEqual(after + 1000);
  });

  it('merges caller createdAt.gt with retention floor', () => {
    let floor = getRetentionCutoffDate(30);
    let later = new Date(floor.getTime() + 60_000);

    let filter = mergeRetentionWithDateFilter({ logRetentionInDays: 30 }, { gt: later });

    expect(filter.createdAt.gte).toEqual(later);
  });

  it('skips session retention when enforceSessionExpiry is false', () => {
    expect(
      getSessionRetentionFilter({ logRetentionInDays: 30, enforceSessionExpiry: false })
    ).toBeUndefined();
  });

  it('applies session retention when enforceSessionExpiry is true', () => {
    expect(
      getSessionRetentionFilter({ logRetentionInDays: 7, enforceSessionExpiry: true })
    ).toHaveProperty('createdAt.gte');
  });

  it('hides stale connections regardless of connection state', () => {
    let filter = getConnectionRetentionFilter({ logRetentionInDays: 30 });

    expect(filter.OR).toEqual([
      { lastActiveAt: { gte: expect.any(Date) } },
      { lastActiveAt: null, createdAt: { gte: expect.any(Date) } }
    ]);
    expect(filter.OR).not.toEqual(
      expect.arrayContaining([{ state: { not: 'disconnected' } }])
    );
  });
});
