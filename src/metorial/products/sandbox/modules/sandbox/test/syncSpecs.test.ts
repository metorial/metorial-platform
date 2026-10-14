import { beforeEach, describe, expect, it, vi } from 'vitest';

let regionQueue = { addManyWithOps: vi.fn(), process: vi.fn((fn: any) => ({ fn })) };
let startupQueue = { addManyWithOps: vi.fn(), process: vi.fn((fn: any) => ({ fn })) };
let queueOptions: any[] = [];

let sandboxingEnabled = { value: true };

let db = { sandboxRegion: { findMany: vi.fn(), findFirst: vi.fn() } };

vi.mock('@metorial/db', () => ({ db }));
vi.mock('@metorial/cron', () => ({
  createCron: vi.fn((opts: any, fn: any) => ({ opts, fn }))
}));
vi.mock('@metorial/queue', () => ({
  createQueue: vi.fn((opts: any) => {
    queueOptions.push(opts);
    return opts.name.endsWith('startup') ? startupQueue : regionQueue;
  }),
  combineQueueProcessors: vi.fn((processors: any) => processors)
}));
vi.mock('../src/lib/regions', () => ({
  isSandboxingEnabled: () => sandboxingEnabled.value
}));
vi.mock('../src/internal/regionInternal', () => ({
  sandboxRegionInternalService: { syncFromEnv: vi.fn() }
}));
vi.mock('../src/internal/specInternal', () => ({
  sandboxSpecInternalService: { syncRegion: vi.fn() }
}));

let { syncSpecsCron, syncSpecsStartupTrigger, syncSpecsStartupQueueProcessor } =
  await import('../src/queues/syncSpecs');
let { sandboxRegionInternalService } = await import('../src/internal/regionInternal');

describe('spec sync scheduling', () => {
  beforeEach(() => {
    db.sandboxRegion.findMany.mockReset();
    db.sandboxRegion.findMany.mockResolvedValue([{ oid: 1n }, { oid: 2n }]);
    regionQueue.addManyWithOps.mockClear();
    startupQueue.addManyWithOps.mockClear();
    sandboxingEnabled.value = true;
  });

  it('runs the cron once a day', () => {
    expect((syncSpecsCron as any).opts.cron).toBe('0 3 * * *');
  });

  it('limits the startup sync to one run per hour', () => {
    let options = queueOptions.find(o => o.name == 'sbx/spec/sync/startup');

    expect(options.workerOpts.limiter).toEqual({ max: 1, duration: 60 * 60 * 1000 });
  });

  it('enqueues a deduplicated startup job when the worker starts', async () => {
    await (syncSpecsStartupTrigger as any).start();

    expect(startupQueue.addManyWithOps).toHaveBeenCalledWith([
      { data: {}, opts: { id: 'startup' } }
    ]);
  });

  it('does not enqueue the startup job when sandboxing is disabled', async () => {
    sandboxingEnabled.value = false;

    await (syncSpecsStartupTrigger as any).start();

    expect(startupQueue.addManyWithOps).not.toHaveBeenCalled();
  });

  it('fans the startup job out to a sync per active region', async () => {
    await (syncSpecsStartupQueueProcessor as any).fn();

    expect(sandboxRegionInternalService.syncFromEnv).toHaveBeenCalled();
    expect(regionQueue.addManyWithOps).toHaveBeenCalledWith([
      { data: { regionOid: '1' }, opts: { id: 'region-1' } },
      { data: { regionOid: '2' }, opts: { id: 'region-2' } }
    ]);
  });

  it('fans the cron out the same way', async () => {
    await (syncSpecsCron as any).fn();

    expect(regionQueue.addManyWithOps).toHaveBeenCalledTimes(1);
  });
});
