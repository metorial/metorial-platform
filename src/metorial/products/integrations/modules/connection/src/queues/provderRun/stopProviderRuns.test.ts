import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  handlers: [] as any[],
  add: vi.fn(),
  db: { providerRun: { findMany: vi.fn(), updateMany: vi.fn() } }
}));

vi.mock('@lowerdeck/cron', () => ({ createCron: () => ({}) }));
vi.mock('@lowerdeck/queue', () => ({
  combineQueueProcessors: (processors: any[]) => processors,
  createQueue: () => ({
    add: mocks.add,
    process: (handler: any) => {
      mocks.handlers.push(handler);
      return { handler };
    }
  })
}));
vi.mock('@metorial-subspace/db', () => ({ db: mocks.db }));
vi.mock('../../env', () => ({ env: { service: { REDIS_URL: 'redis://localhost:6379' } } }));

import './stopProviderRuns';

let run = (data: { cursor?: string }) => mocks.handlers[0](data);

let runs = (count: number, from = 1) =>
  Array.from({ length: count }, (_, i) => ({ oid: BigInt(from + i) }));

describe('stopProviderRuns', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.db.providerRun.updateMany.mockResolvedValue({ count: 0 });
  });

  it('also stops runs that never pinged, by their creation time', async () => {
    mocks.db.providerRun.findMany.mockResolvedValue(runs(2));

    await run({});

    let { where } = mocks.db.providerRun.findMany.mock.calls[0]![0];
    expect(where.status).toBe('running');
    expect(where.OR).toEqual([
      { lastPingAt: { lt: expect.any(Date) } },
      { lastPingAt: null, createdAt: { lt: expect.any(Date) } }
    ]);
  });

  it('pages by oid and stops after a partial page', async () => {
    mocks.db.providerRun.findMany.mockResolvedValueOnce(runs(500));

    await run({});

    expect(mocks.add).toHaveBeenCalledWith({ cursor: '500' }, { delay: 250 });

    mocks.add.mockClear();
    mocks.db.providerRun.findMany.mockResolvedValueOnce(runs(3, 501));

    await run({ cursor: '500' });

    expect(mocks.db.providerRun.findMany.mock.calls[1]![0].where.oid).toEqual({ gt: 500n });
    expect(mocks.db.providerRun.updateMany.mock.calls[1]![0].where.oid).toEqual({
      in: [501n, 502n, 503n]
    });
    expect(mocks.add).not.toHaveBeenCalled();
  });
});
