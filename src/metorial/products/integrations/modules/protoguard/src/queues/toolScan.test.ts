import { beforeEach, describe, expect, it, vi } from 'vitest';
import { activeRuleset } from '../definitions/rulesets';

let mocks = vi.hoisted(() => ({
  processors: new Map<string, (data: any) => Promise<unknown>>(),
  queues: new Map<string, { add: any; addManyWithOps: any }>(),
  findTools: vi.fn(),
  commitWatermarkScan: vi.fn(),
  scanProviderTool: vi.fn(),
  pacedDelay: { delay: 1234 }
}));

vi.mock('@lowerdeck/cron', () => ({
  createCron: () => ({ type: 'cron' })
}));

vi.mock('@lowerdeck/queue', () => ({
  combineQueueProcessors: (processors: unknown[]) => processors,
  hourlyPacedDelay: () => mocks.pacedDelay,
  createQueue: (opts: { name: string }) => {
    let queue = { add: vi.fn(), addManyWithOps: vi.fn() };
    mocks.queues.set(opts.name, queue);

    return {
      ...queue,
      process: (fn: (data: any) => Promise<unknown>) => {
        mocks.processors.set(opts.name, fn);
        return { name: opts.name };
      }
    };
  }
}));

vi.mock('@lowerdeck/queue-checkpoint', () => ({
  createQueueCheckpoint: () => ({ type: 'checkpoint' }),
  enqueueWatermarkScan: vi.fn(),
  commitWatermarkScan: mocks.commitWatermarkScan
}));

vi.mock('@metorial-subspace/db', () => ({
  db: { providerTool: { findMany: mocks.findTools } }
}));

vi.mock('../env', () => ({
  env: { service: { REDIS_URL: 'redis://localhost:6379' } }
}));

vi.mock('../internal/toolScan', () => ({
  protoGuardToolScanService: { scanProviderTool: mocks.scanProviderTool }
}));

await import('./toolScan');

let many = mocks.processors.get('sub/pg/tool/many')!;
let single = mocks.processors.get('sub/pg/tool/single')!;
let manyQueue = mocks.queues.get('sub/pg/tool/many')!;
let singleQueue = mocks.queues.get('sub/pg/tool/single')!;

let tools = (count: number, offset = 0) =>
  Array.from({ length: count }, (_, i) => ({
    oid: BigInt(offset + i + 1),
    id: `ptool_${String(offset + i + 1).padStart(5, '0')}`
  }));

describe('tool scan queues', () => {
  beforeEach(() => {
    mocks.findTools.mockReset();
    mocks.commitWatermarkScan.mockReset();
    mocks.scanProviderTool.mockReset();
    manyQueue.add.mockReset();
    singleQueue.addManyWithOps.mockReset();
  });

  it('pages 500 unscanned tools at a time in id order', async () => {
    mocks.findTools.mockResolvedValue([]);
    await many({ since: '2026-01-01T00:00:00.000Z', cursor: 'ptool_00010' });

    expect(mocks.findTools).toHaveBeenCalledWith({
      where: {
        createdAt: { gte: new Date('2026-01-01T00:00:00.000Z') },
        id: { gt: 'ptool_00010' },
        protoGuardToolScans: { none: { rulesetVersion: activeRuleset.version } }
      },
      select: { oid: true, id: true },
      orderBy: { id: 'asc' },
      take: 500
    });
  });

  it('omits since and cursor filters for a full pass', async () => {
    mocks.findTools.mockResolvedValue([]);
    await many({});

    expect(mocks.findTools.mock.calls[0]![0].where).toEqual({
      protoGuardToolScans: { none: { rulesetVersion: activeRuleset.version } }
    });
  });

  it('fans out single jobs keyed by tool id and ruleset version', async () => {
    mocks.findTools.mockResolvedValue(tools(2));
    await many({});

    expect(singleQueue.addManyWithOps).toHaveBeenCalledWith([
      {
        data: { providerToolOid: '1' },
        opts: { id: `ptool_00001-${activeRuleset.version}` }
      },
      {
        data: { providerToolOid: '2' },
        opts: { id: `ptool_00002-${activeRuleset.version}` }
      }
    ]);
  });

  it('re-enqueues itself after a full page with a paced delay', async () => {
    let job = { since: '2026-01-01T00:00:00.000Z', cursor: null };
    mocks.findTools.mockResolvedValue(tools(500));
    await many(job);

    expect(manyQueue.add).toHaveBeenCalledWith(
      { ...job, cursor: 'ptool_00500' },
      mocks.pacedDelay
    );
    expect(mocks.commitWatermarkScan).not.toHaveBeenCalled();
  });

  it('commits the watermark after a partial page', async () => {
    let job = { since: null, cursor: 'ptool_00500' };
    mocks.findTools.mockResolvedValue(tools(3, 500));
    await many(job);

    expect(manyQueue.add).not.toHaveBeenCalled();
    expect(mocks.commitWatermarkScan).toHaveBeenCalledWith({
      checkpoint: expect.anything(),
      job
    });
  });

  it('commits the watermark without enqueueing on an empty page', async () => {
    mocks.findTools.mockResolvedValue([]);
    await many({});

    expect(singleQueue.addManyWithOps).not.toHaveBeenCalled();
    expect(mocks.commitWatermarkScan).toHaveBeenCalledTimes(1);
  });

  it('scans the tool for a single job', async () => {
    await single({ providerToolOid: '42' });

    expect(mocks.scanProviderTool).toHaveBeenCalledWith({ providerToolOid: BigInt(42) });
  });
});
