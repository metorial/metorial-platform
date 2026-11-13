import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  findRolled: vi.fn(),
  queryRaw: vi.fn(),
  aggregate: vi.fn()
}));

vi.mock('@metorial-subspace/db', () => ({
  db: {
    providerToolUsageHourly: { findFirst: mocks.findRolled },
    $queryRaw: mocks.queryRaw
  }
}));

vi.mock('./rollup', () => ({
  floorToHour: (date: Date) => new Date(Math.floor(date.getTime() / 3_600_000) * 3_600_000),
  aggregateUsageHour: mocks.aggregate
}));

import { hasObservedUsage, refreshRecentUsage } from './presence';

let scope = { instanceOid: 1n, providerOid: 2n };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findRolled.mockResolvedValue(null);
  mocks.queryRaw.mockResolvedValue([]);
});

describe('hasObservedUsage', () => {
  it('is true when the rollups hold a call', async () => {
    mocks.findRolled.mockResolvedValue({ toolKey: 'search' });

    expect(await hasObservedUsage(scope)).toBe(true);
    expect(mocks.queryRaw).not.toHaveBeenCalled();
  });

  it('falls back to calls the rollups have not caught up with', async () => {
    mocks.queryRaw.mockResolvedValue([{ found: 1 }]);

    expect(await hasObservedUsage(scope)).toBe(true);
  });

  it('is false without any call', async () => {
    expect(await hasObservedUsage(scope)).toBe(false);
  });
});

describe('refreshRecentUsage', () => {
  it('rolls up the previous and the current hour for this instance and provider only', async () => {
    await refreshRecentUsage(scope);

    expect(mocks.aggregate).toHaveBeenCalledTimes(2);
    expect(mocks.aggregate.mock.calls.every(([arg]) => arg.scope == scope)).toBe(true);

    let [first, second] = mocks.aggregate.mock.calls.map(([arg]) => arg.hour.getTime());
    expect(second - first).toBe(3_600_000);
  });
});
