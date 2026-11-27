import {
  ServiceError,
  badRequestError,
  createError,
  internalServerError,
  preconditionFailedError
} from '@lowerdeck/error';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let local = vi.hoisted(() => ({
  credential: true,
  checkpoints: new Map<string, Date>(),
  commits: [] as { queue: string; through: Date }[],
  checkpointReads: 0,
  databaseNow: new Date('2026-11-27T12:00:00Z'),
  toolDetails: true,
  upsert: vi.fn()
}));

vi.mock('@metorial/queue', async () => (await import('./_mocks')).queueModule);
vi.mock('@metorial/cron', async () => (await import('./_mocks')).cronModule);
vi.mock('../src/lib/client', async () => (await import('./_mocks')).clientModule);
vi.mock('../src/lib/flag', async () => (await import('./_mocks')).flagModule);

vi.mock('../src/lib/scope', () => ({
  withInstanceScope: vi.fn(async (_scope: unknown, run: () => Promise<unknown>) => await run())
}));

vi.mock('../src/lib/settings', async importOriginal => ({
  ...(await importOriginal<typeof import('../src/lib/settings')>()),
  readOrganizationSettings: vi.fn(async () => ({ toolDetails: local.toolDetails }))
}));

vi.mock('@metorial/db', () => ({
  db: {
    instance: { findUnique: vi.fn(), findMany: vi.fn() },
    agentTrackingIngestToken: {
      groupBy: vi.fn(),
      findFirst: vi.fn(async () => (local.credential ? { oid: 1n } : null))
    },
    agentTrackingIngestSource: { groupBy: vi.fn(), findFirst: vi.fn(async () => null) },
    queueCheckpoint: {
      findUnique: vi.fn(async (args: { where: { queue: string } }) =>
        local.checkpoints.has(args.where.queue) ? { queue: args.where.queue } : null
      ),
      findMany: vi.fn(),
      deleteMany: vi.fn(async (args: { where: { queue: string | { in: string[] } } }) => {
        let queues =
          typeof args.where.queue == 'string' ? [args.where.queue] : args.where.queue.in;
        for (let name of queues) local.checkpoints.delete(name);
        return { count: queues.length };
      })
    }
  }
}));

vi.mock('@metorial-subspace/db', () => ({
  db: {
    $queryRaw: vi.fn(async () => [{ now: local.databaseNow }]),
    environment: { findUnique: vi.fn() },
    sessionMessage: { findMany: vi.fn() }
  }
}));

vi.mock('@metorial/module-usage', () => ({
  resolveUsageSessionDimsMany: vi.fn(async () => new Map())
}));

vi.mock('@lowerdeck/queue-checkpoint', () => ({
  createQueueCheckpoint: (d: { queue: string }) => ({
    queue: d.queue,
    since: async () => {
      local.checkpointReads++;
      return local.checkpoints.get(d.queue);
    },
    commit: async (through: Date) => {
      local.commits.push({ queue: d.queue, through });
      local.checkpoints.set(d.queue, through);
    }
  })
}));

import { db as subspaceDb } from '@metorial-subspace/db';
import { db } from '@metorial/db';
import { resolveUsageSessionDimsMany } from '@metorial/module-usage';
import { toolCallLinksOf } from '../src/lib/toolCalls';
import {
  pushToolCallsCron,
  pushToolCallsInstanceQueue,
  pushToolCallsInstanceQueueProcessor,
  pushToolCallsManyQueue,
  pushToolCallsManyQueueProcessor
} from '../src/queues/pushToolCalls';
import { withInstanceScope } from '../src/lib/scope';
import { mocks, resetMocks } from './_mocks';

let queue = 'agent-tracking/tool-calls/ins_1';

let instance = {
  oid: 7n,
  id: 'ins_1',
  name: 'Production',
  status: 'active',
  agentTrackingLinkedAt: new Date('2026-11-01T00:00:00Z'),
  subspaceEnvironmentId: 'env_1',
  organization: { oid: 1n, id: 'org_1', name: 'Acme', status: 'active' },
  project: { oid: 2n, id: 'prj_1', name: 'Main', status: 'active' }
};

let upTo = new Date('2026-11-27T11:59:30Z');

let message = (d: {
  id: string;
  at: string;
  oid?: bigint;
  clientCallId?: string | null;
  source?: string | null;
  providerId?: string | null;
}) => ({
  oid: d.oid ?? BigInt(Date.parse(d.at)),
  createdAt: new Date(d.at),
  session: { oid: 11n, id: 'ses_1' },
  sessionProvider:
    d.providerId === null
      ? null
      : { provider: { id: d.providerId ?? 'pro_1' }, deployment: { id: 'pdep_1' } },
  toolCall: {
    id: d.id,
    toolKey: 'search',
    clientCallId: d.clientCallId === undefined ? `call_${d.id}` : d.clientCallId,
    clientCallSource: d.source === undefined ? 'codex' : d.source
  }
});

let run = (data: Record<string, unknown> = {}) =>
  (pushToolCallsInstanceQueueProcessor as any).handler({ instanceOid: '7', ...data });

let findMany = () => vi.mocked(subspaceDb.sessionMessage.findMany);

let sent = () => local.upsert.mock.calls.flatMap(call => call[0].links);

describe('agent-tracking/tool-calls', () => {
  beforeEach(() => {
    resetMocks();

    local.checkpoints.clear();
    local.commits = [];
    local.checkpointReads = 0;
    local.databaseNow = new Date('2026-11-27T12:00:00Z');
    local.toolDetails = true;
    local.credential = true;
    local.upsert.mockReset().mockResolvedValue({ written: 1 });
    mocks.agentTracking.toolCallLink = { upsert: local.upsert };

    vi.mocked(db.instance.findUnique).mockResolvedValue(instance as any);
    vi.mocked(subspaceDb.environment.findUnique).mockResolvedValue({
      oid: 30n,
      tenantOid: 40n
    } as any);
    findMany().mockResolvedValue([]);
    vi.mocked(resolveUsageSessionDimsMany).mockResolvedValue(
      new Map([['11', { integrationId: 'int_1', magicMcpServerId: null }]])
    );
  });

  it('walks the credential tables one cursor at a time, paces instances, runs every 5 minutes', () => {
    expect((pushToolCallsManyQueue as any).workerOpts).toEqual({ concurrency: 1 });
    expect((pushToolCallsInstanceQueue as any).workerOpts).toEqual({
      concurrency: 5,
      limiter: { max: 10, duration: 1000 }
    });
    expect((pushToolCallsCron as any).config).toMatchObject({ cron: '*/5 * * * *' });
  });

  it('starts both credential scans, and none while agent tracking is off', async () => {
    await (pushToolCallsCron as any).handler();
    expect(pushToolCallsManyQueue.addMany).toHaveBeenCalledWith([
      { credential: 'token' },
      { credential: 'source' },
      { credential: 'checkpoint' }
    ]);

    vi.mocked(pushToolCallsManyQueue.addMany).mockClear();
    mocks.enabled.value = false;
    await (pushToolCallsCron as any).handler();
    expect(pushToolCallsManyQueue.addMany).not.toHaveBeenCalled();
  });

  it('fans out one job per instance that never runs next to another for it', async () => {
    vi.mocked(db.agentTrackingIngestToken.groupBy).mockResolvedValue([
      { instanceOid: 7n },
      { instanceOid: 9n }
    ] as any);

    await (pushToolCallsManyQueueProcessor as any).handler({
      credential: 'token',
      cursor: '3'
    });

    expect(db.agentTrackingIngestToken.groupBy).toHaveBeenCalledWith({
      by: ['instanceOid'],
      where: { status: 'active', instanceOid: { gt: 3n } },
      orderBy: { instanceOid: 'asc' },
      take: 500
    });
    expect(pushToolCallsInstanceQueue.addManyWithOps).toHaveBeenCalledWith([
      {
        data: { instanceOid: '7' },
        opts: { deduplication: { id: 'tool-calls-7', keepLastIfActive: true } }
      },
      {
        data: { instanceOid: '9' },
        opts: { deduplication: { id: 'tool-calls-9', keepLastIfActive: true } }
      }
    ]);
    expect(pushToolCallsManyQueue.add).not.toHaveBeenCalled();
  });

  it('continues the credential scan only after a full page', async () => {
    vi.mocked(db.agentTrackingIngestSource.groupBy).mockResolvedValue(
      Array.from({ length: 500 }, (_, index) => ({ instanceOid: BigInt(index + 1) })) as any
    );

    await (pushToolCallsManyQueueProcessor as any).handler({ credential: 'source' });

    expect(pushToolCallsManyQueue.add).toHaveBeenCalledWith(
      { credential: 'source', cursor: '500' },
      expect.anything()
    );
  });

  it('reads nothing and clears the checkpoint for an organization with the flag off', async () => {
    mocks.flagged.value = false;
    local.checkpoints.set(queue, new Date('2026-11-27T11:00:00Z'));

    await run();

    expect(subspaceDb.$queryRaw).not.toHaveBeenCalled();
    expect(subspaceDb.environment.findUnique).not.toHaveBeenCalled();
    expect(findMany()).not.toHaveBeenCalled();
    expect(resolveUsageSessionDimsMany).not.toHaveBeenCalled();
    expect(local.upsert).not.toHaveBeenCalled();
    expect(local.checkpoints.has(queue)).toBe(false);

    expect(db.queueCheckpoint.deleteMany).toHaveBeenCalledWith({ where: { queue } });
    expect(db.queueCheckpoint.findUnique).not.toHaveBeenCalled();
    expect(local.commits).toEqual([]);
  });

  it('never sends calls made while the flag was off', async () => {
    await run();
    expect(local.checkpoints.get(queue)).toEqual(upTo);

    mocks.flagged.value = false;
    await run();

    mocks.flagged.value = true;
    local.databaseNow = new Date('2026-11-27T13:00:00Z');
    await run();
    expect(findMany()).not.toHaveBeenCalled();
    expect(local.checkpoints.get(queue)).toEqual(new Date('2026-11-27T12:59:30Z'));

    local.databaseNow = new Date('2026-11-27T13:05:00Z');
    findMany().mockResolvedValue([
      message({ id: 'tcal_after', at: '2026-11-27T13:01:00Z' })
    ] as any);
    await run();

    expect(findMany().mock.calls[0]![0]).toMatchObject({
      where: { createdAt: { gte: new Date('2026-11-27T12:59:30Z') } }
    });
    expect(sent().map(link => link.metorial.toolCallId)).toEqual(['tcal_after']);
  });

  it.each([
    ['not linked', { agentTrackingLinkedAt: null }],
    ['archived', { status: 'archived' }],
    ['in an archived project', { project: { ...instance.project, status: 'archived' } }],
    [
      'in an inactive organization',
      { organization: { ...instance.organization, status: 'deleted' } }
    ]
  ])('clears the checkpoint of an instance %s and reads nothing for it', async (_, change) => {
    local.checkpoints.set(queue, new Date('2026-11-27T11:00:00Z'));
    vi.mocked(db.instance.findUnique).mockResolvedValueOnce({ ...instance, ...change } as any);

    await run();

    expect(local.checkpoints.has(queue)).toBe(false);
    expect(subspaceDb.$queryRaw).not.toHaveBeenCalled();
    expect(findMany()).not.toHaveBeenCalled();
    expect(local.commits).toEqual([]);
  });

  it('clears the checkpoint of an instance without an active credential', async () => {
    local.credential = false;
    local.checkpoints.set(queue, new Date('2026-11-27T11:00:00Z'));

    await run();

    expect(local.checkpoints.has(queue)).toBe(false);
    expect(subspaceDb.$queryRaw).not.toHaveBeenCalled();
    expect(findMany()).not.toHaveBeenCalled();
  });

  it('visits every instance that still has a checkpoint and drops those of deleted instances', async () => {
    local.checkpoints.set(queue, new Date('2026-11-27T11:00:00Z'));
    local.checkpoints.set(
      'agent-tracking/tool-calls/ins_gone',
      new Date('2026-11-27T11:00:00Z')
    );
    vi.mocked(db.queueCheckpoint.findMany).mockResolvedValue([
      { queue },
      { queue: 'agent-tracking/tool-calls/ins_gone' }
    ] as any);
    vi.mocked(db.instance.findMany).mockResolvedValue([{ id: 'ins_1', oid: 7n }] as any);

    await (pushToolCallsManyQueueProcessor as any).handler({ credential: 'checkpoint' });

    expect(db.queueCheckpoint.findMany).toHaveBeenCalledWith({
      where: {
        queue: { gte: 'agent-tracking/tool-calls/', lt: 'agent-tracking/tool-calls0' }
      },
      orderBy: { queue: 'asc' },
      take: 500,
      select: { queue: true }
    });
    expect(local.checkpoints.has('agent-tracking/tool-calls/ins_gone')).toBe(false);
    expect(local.checkpoints.has(queue)).toBe(true);
    expect(pushToolCallsInstanceQueue.addManyWithOps).toHaveBeenCalledWith([
      {
        data: { instanceOid: '7' },
        opts: { deduplication: { id: 'tool-calls-7', keepLastIfActive: true } }
      }
    ]);
    expect(findMany()).not.toHaveBeenCalled();
  });

  it('starts at the present on the first run instead of sending older calls', async () => {
    await run();

    expect(findMany()).not.toHaveBeenCalled();
    expect(local.commits).toEqual([{ queue, through: upTo }]);
  });

  it('scans tool-call messages on the tenant and time index, bounded by the database clock', async () => {
    local.checkpoints.set(queue, new Date('2026-11-27T11:58:00Z'));
    findMany().mockResolvedValue([
      message({ id: 'tcal_1', at: '2026-11-27T11:58:10Z' }),
      message({ id: 'tcal_2', at: '2026-11-27T11:58:20Z', source: 'claude-code' })
    ] as any);

    await run();

    expect(findMany()).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantOid: 40n,
          environmentOid: 30n,
          createdAt: { gte: new Date('2026-11-27T11:58:00Z'), lt: upTo },
          toolCall: {
            is: {
              tenantOid: 40n,
              clientCallId: { not: null },
              clientCallSource: { not: null }
            }
          }
        },
        orderBy: [{ createdAt: 'asc' }, { oid: 'asc' }],
        take: 200
      })
    );
    expect(local.upsert).toHaveBeenCalledWith({
      organizationId: 'org_1',
      instanceId: 'ins_1',
      links: [
        {
          clientFamily: 'codex',
          toolCallId: 'call_tcal_1',
          calledAt: new Date('2026-11-27T11:58:10Z'),
          metorial: {
            toolCallId: 'tcal_1',
            providerId: 'pro_1',
            toolKey: 'search',
            deploymentId: 'pdep_1',
            integrationId: 'int_1'
          }
        },
        expect.objectContaining({ clientFamily: 'claude-code', toolCallId: 'call_tcal_2' })
      ]
    });
    expect(local.commits).toEqual([{ queue, through: upTo }]);
    expect(pushToolCallsInstanceQueue.add).not.toHaveBeenCalled();
  });

  it('sends no tool key while Detailed Tool Reporting is off', async () => {
    local.toolDetails = false;
    local.checkpoints.set(queue, new Date('2026-11-27T11:58:00Z'));
    findMany().mockResolvedValue([
      message({ id: 'tcal_1', at: '2026-11-27T11:58:10Z' })
    ] as any);

    await run();

    expect(sent()[0].metorial).toEqual({
      toolCallId: 'tcal_1',
      providerId: 'pro_1',
      deploymentId: 'pdep_1',
      integrationId: 'int_1'
    });
  });

  it('keeps the checkpoint when the service fails, so the retry sends the same calls', async () => {
    let since = new Date('2026-11-27T11:58:00Z');
    local.checkpoints.set(queue, since);
    findMany().mockResolvedValue([
      message({ id: 'tcal_1', at: '2026-11-27T11:58:10Z' })
    ] as any);
    local.upsert.mockRejectedValueOnce(new ServiceError(internalServerError()));

    await expect(run()).rejects.toBeInstanceOf(ServiceError);
    expect(local.commits).toEqual([]);

    await run();

    expect(sent().map(link => link.metorial.toolCallId)).toEqual(['tcal_1', 'tcal_1']);
    expect(findMany().mock.calls[1]![0]).toMatchObject({
      where: { createdAt: { gte: since } }
    });
    expect(local.commits).toEqual([{ queue, through: upTo }]);
  });

  it('retries transport errors without moving the checkpoint', async () => {
    local.checkpoints.set(queue, new Date('2026-11-27T11:58:00Z'));
    findMany().mockResolvedValue([
      message({ id: 'tcal_1', at: '2026-11-27T11:58:10Z' })
    ] as any);
    local.upsert.mockRejectedValueOnce(new Error('socket hang up'));

    await expect(run()).rejects.toThrow('socket hang up');
    expect(local.commits).toEqual([]);
  });

  it('skips a page the link route rejects as invalid and names only instance and status', async () => {
    let warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    local.checkpoints.set(queue, new Date('2026-11-27T11:58:00Z'));
    findMany().mockResolvedValue([
      message({ id: 'tcal_1', at: '2026-11-27T11:58:10Z' })
    ] as any);
    local.upsert.mockRejectedValueOnce(
      new ServiceError(badRequestError({ message: 'invalid' }))
    );

    await run();

    expect(local.commits).toEqual([{ queue, through: upTo }]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]).toHaveLength(1);
    expect(warn.mock.calls[0]![0]).toContain('ins_1');
    expect(warn.mock.calls[0]![0]).toContain('400');
    expect(warn.mock.calls[0]![0]).not.toContain('tcal_1');
    warn.mockRestore();
  });

  it('stops quietly without moving the checkpoint while the link route has no record store', async () => {
    let warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    let since = new Date('2026-11-27T11:58:00Z');
    local.checkpoints.set(queue, since);
    findMany().mockResolvedValue([
      message({ id: 'tcal_1', at: '2026-11-27T11:58:10Z' })
    ] as any);
    local.upsert.mockRejectedValueOnce(
      new ServiceError(preconditionFailedError({ message: 'no store' }))
    );

    await run();

    expect(local.commits).toEqual([]);
    expect(local.checkpoints.get(queue)).toEqual(since);
    expect(pushToolCallsInstanceQueue.add).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]).toHaveLength(1);
    expect(warn.mock.calls[0]![0]).toContain('412');
    warn.mockRestore();
  });

  it.each([401, 403, 408, 429])('retries a %s from the link route', async status => {
    local.checkpoints.set(queue, new Date('2026-11-27T11:58:00Z'));
    findMany().mockResolvedValue([
      message({ id: 'tcal_1', at: '2026-11-27T11:58:10Z' })
    ] as any);
    local.upsert.mockRejectedValueOnce(
      new ServiceError(createError({ status, code: 'refused', message: 'refused' })())
    );

    await expect(run()).rejects.toBeInstanceOf(ServiceError);
    expect(local.commits).toEqual([]);
  });

  it('keeps the scope set-up errors as they are instead of skipping the page', async () => {
    local.checkpoints.set(queue, new Date('2026-11-27T11:58:00Z'));
    findMany().mockResolvedValue([
      message({ id: 'tcal_1', at: '2026-11-27T11:58:10Z' })
    ] as any);
    vi.mocked(withInstanceScope).mockRejectedValueOnce(
      new ServiceError(badRequestError({ message: 'scope' }))
    );

    await expect(run()).rejects.toBeInstanceOf(ServiceError);
    expect(local.upsert).not.toHaveBeenCalled();
    expect(local.commits).toEqual([]);
  });

  it('drops calls that cannot make a valid link and sends nothing when none is left', async () => {
    local.checkpoints.set(queue, new Date('2026-11-27T11:58:00Z'));
    findMany().mockResolvedValue([
      message({ id: 'tcal_1', at: '2026-11-27T11:58:10Z', clientCallId: '' }),
      message({ id: 'tcal_2', at: '2026-11-27T11:58:11Z', providerId: null }),
      message({ id: 'tcal_3', at: '2026-11-27T11:58:12Z', source: '' })
    ] as any);

    await run();

    expect(local.upsert).not.toHaveBeenCalled();
    expect(local.commits).toEqual([{ queue, through: upTo }]);
  });

  it('pages through more than a page of calls in one millisecond without losing any', async () => {
    local.checkpoints.set(queue, new Date('2026-11-27T11:00:00Z'));
    let at = '2026-11-27T11:30:00.000Z';
    let all = Array.from({ length: 250 }, (_, index) =>
      message({ id: `tcal_${index}`, at, oid: BigInt(index + 1) })
    );
    findMany()
      .mockResolvedValueOnce(all.slice(0, 200) as any)
      .mockResolvedValueOnce(all.slice(200) as any);

    await run();

    let continuation = vi.mocked(pushToolCallsInstanceQueue.add).mock.calls[0]!;
    expect(continuation[0]).toEqual({
      instanceOid: '7',
      window: {
        since: '2026-11-27T11:00:00.000Z',
        upTo: upTo.toISOString(),
        after: { createdAt: at, oid: '200' }
      }
    });
    expect(continuation[1]).toMatchObject({
      deduplication: { id: 'tool-calls-7', keepLastIfActive: true }
    });
    expect(local.commits).toEqual([{ queue, through: new Date(at) }]);

    await run(continuation[0] as Record<string, unknown>);

    expect(findMany().mock.calls[1]![0]).toMatchObject({
      where: {
        createdAt: { gte: new Date(at), lt: upTo },
        OR: [
          { createdAt: { gt: new Date(at) } },
          { createdAt: new Date(at), oid: { gt: 200n } }
        ]
      }
    });
    expect(subspaceDb.$queryRaw).toHaveBeenCalledTimes(1);
    expect(sent()).toHaveLength(250);
    expect(local.commits[1]).toEqual({ queue, through: upTo });
  });

  it('reads no tool calls for an instance that never used integrations', async () => {
    local.checkpoints.set(queue, new Date('2026-11-27T11:58:00Z'));
    vi.mocked(db.instance.findUnique).mockResolvedValue({
      ...instance,
      subspaceEnvironmentId: null
    } as any);

    await run();

    expect(subspaceDb.environment.findUnique).not.toHaveBeenCalled();
    expect(findMany()).not.toHaveBeenCalled();
    expect(local.upsert).not.toHaveBeenCalled();
  });
});

describe('toolCallLinksOf', () => {
  it('leaves out ids the usage dimensions do not know', () => {
    expect(
      toolCallLinksOf({
        messages: [
          {
            ...message({ id: 'tcal_1', at: '2026-11-27T11:58:10Z' }),
            sessionProvider: { provider: { id: 'pro_1' }, deployment: null }
          }
        ],
        sessionDims: new Map(),
        toolDetails: true
      })
    ).toEqual([
      {
        clientFamily: 'codex',
        toolCallId: 'call_tcal_1',
        calledAt: new Date('2026-11-27T11:58:10Z'),
        metorial: { toolCallId: 'tcal_1', providerId: 'pro_1', toolKey: 'search' }
      }
    ]);
  });
});
