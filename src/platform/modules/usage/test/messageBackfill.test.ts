import { beforeEach, describe, expect, it, vi } from 'vitest';
import { USAGE_MESSAGE_BACKFILL_ID, USAGE_MESSAGE_REVISION } from '../src/lib/messageRevision';

let mocks = vi.hoisted(() => ({
  cron: null as unknown as () => Promise<void>,
  process: null as unknown as (data: Record<string, unknown>) => Promise<void>,
  findMany: vi.fn(),
  getState: vi.fn(),
  updateSource: vi.fn(),
  bulkWrite: vi.fn(),
  add: vi.fn(),
  addManyWithOps: vi.fn()
}));

vi.mock('@metorial-subspace/db', () => ({
  db: { sessionMessage: { findMany: mocks.findMany } }
}));

vi.mock('@metorial/db', () => ({ db: {} }));

vi.mock('@metorial/cron', () => ({
  createCron: (_options: unknown, handler: typeof mocks.cron) => {
    mocks.cron = handler;
    return {};
  }
}));

vi.mock('@metorial/queue', () => ({
  createQueue: () => ({
    add: mocks.add,
    addManyWithOps: mocks.addManyWithOps,
    process: (handler: typeof mocks.process) => {
      mocks.process = handler;
      return {};
    }
  }),
  combineQueueProcessors: () => ({}),
  hourlyPacedDelay: () => ({ delay: 500 })
}));

vi.mock('../src/models', () => ({
  USAGE_RETENTION_MS: 30 * 24 * 60 * 60 * 1000,
  UsageMetricModel: { bulkWrite: mocks.bulkWrite }
}));

vi.mock('../src/lib/backfillState', () => ({
  getUsageBackfillState: mocks.getState,
  updateUsageBackfillSource: mocks.updateSource
}));

vi.mock('../src/lib/connection', () => ({
  isUsageEnabled: () => true,
  usageDbConnect: async () => {}
}));

vi.mock('../src/lib/subspace', () => ({
  resolveUsageInstances: async () =>
    new Map([['1', { instanceId: 'ins_customer', organizationId: 'org_customer' }]]),
  resolveUsageSessionDimsMany: async () => new Map(),
  resolveUsageConsumerContextsByActor: async () => new Map(),
  resolveUsageAgentIds: async () => () => null
}));

import '../src/queues/backfill';

let cutoff = new Date('2026-11-01T06:30:00Z');

let job = { source: 'session_message', cursor: null, stateId: USAGE_MESSAGE_BACKFILL_ID };

let makeMessage = (oid: number, date: string, status = 'succeeded') => ({
  oid: BigInt(oid),
  type: 'mcp_message',
  status,
  createdAt: new Date(date),
  completedAt: new Date(new Date(date).getTime() + 100),
  finalizedAt: null,
  instanceOid: 1n,
  session: { oid: 1n, id: 'ses_customer', isInternal: false },
  methodOrToolKey: 'manage_forms',
  toolCall: { tool: { key: 'manage_forms' } },
  sessionProvider: null
});

describe('message usage history rebuild', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getState.mockImplementation(async stateId => ({
      cutoff,
      sources:
        stateId == USAGE_MESSAGE_BACKFILL_ID
          ? {}
          : Object.fromEntries(
              [
                'session_message',
                'session',
                'session_connection',
                'session_error',
                'auth_event',
                'auth_error',
                'consumer'
              ].map(source => [source, { done: true }])
            )
    }));
    mocks.findMany.mockResolvedValue([]);
    mocks.bulkWrite.mockResolvedValue({});
    mocks.updateSource.mockResolvedValue(undefined);
  });

  it('rebuilds messages even when the original backfill already completed', async () => {
    await mocks.cron();

    expect(mocks.addManyWithOps).toHaveBeenCalledWith([
      {
        data: job,
        opts: { id: `usage-backfill-${USAGE_MESSAGE_BACKFILL_ID}-session_message-start` }
      }
    ]);
  });

  it('stops scheduling once the revised message backfill completes', async () => {
    mocks.getState.mockResolvedValue({
      cutoff,
      sources: Object.fromEntries(
        [
          'session_message',
          'session',
          'session_connection',
          'session_error',
          'auth_event',
          'auth_error',
          'consumer'
        ].map(source => [source, { done: true }])
      )
    });

    await mocks.cron();

    expect(mocks.addManyWithOps).not.toHaveBeenCalled();
  });

  it('restores calls on every historical day, including calls without a finalization marker', async () => {
    let rows = [
      ...Array.from({ length: 5 }, (_, i) => makeMessage(i + 1, '2026-10-27T13:45:25Z')),
      ...Array.from({ length: 2 }, (_, i) => makeMessage(i + 6, '2026-10-28T10:27:38Z')),
      ...Array.from({ length: 3 }, (_, i) => makeMessage(i + 8, '2026-10-30T13:05:06Z')),
      makeMessage(11, '2026-10-28T10:28:00Z', 'failed')
    ];
    mocks.findMany.mockResolvedValue(rows);

    await mocks.process(job);

    let query = mocks.findMany.mock.calls[0]![0];
    expect(query.where).toMatchObject({
      status: { in: ['succeeded', 'failed'] },
      createdAt: { lt: cutoff },
      session: { isInternal: false }
    });
    expect(query.where).not.toHaveProperty('finalizedAt');

    let documents = mocks.bulkWrite.mock.calls[0]![0].map(
      (operation: any) => operation.updateOne.update.$set
    );
    expect(documents.every((document: any) => document.kind == 'tool_call')).toBe(true);
    expect(
      documents.every((document: any) => document.messageRevision == USAGE_MESSAGE_REVISION)
    ).toBe(true);
    expect(documents.reduce((sum: number, document: any) => sum + document.count, 0)).toBe(11);
    expect(
      documents.reduce((sum: number, document: any) => sum + document.errorCount, 0)
    ).toBe(1);
    expect(
      new Set(documents.map((document: any) => document.ts.toISOString().slice(0, 10))).size
    ).toBe(3);
    expect(mocks.updateSource).toHaveBeenCalledWith(
      'session_message',
      { done: true, cursor: '11' },
      USAGE_MESSAGE_BACKFILL_ID
    );
    expect(mocks.add).not.toHaveBeenCalled();
  });

  it('upserts the same documents when persistence succeeds but checkpointing fails', async () => {
    mocks.findMany.mockResolvedValue([makeMessage(1, '2026-10-27T13:45:25Z')]);
    mocks.updateSource.mockRejectedValueOnce(new Error('checkpoint unavailable'));

    await expect(mocks.process(job)).rejects.toThrow('checkpoint unavailable');
    await mocks.process(job);

    expect(mocks.bulkWrite.mock.calls[1]![0]).toEqual(mocks.bulkWrite.mock.calls[0]![0]);
    expect(mocks.bulkWrite.mock.calls[0]![0][0].updateOne.upsert).toBe(true);
  });

  it('keeps the revision and pacing when a full page needs a continuation', async () => {
    mocks.findMany.mockResolvedValue(
      Array.from({ length: 500 }, (_, i) => makeMessage(i + 1, '2026-10-27T13:45:25Z'))
    );

    await mocks.process(job);

    expect(mocks.findMany.mock.calls[0]![0].take).toBe(500);
    expect(mocks.add).toHaveBeenCalledWith(
      { ...job, cursor: '500' },
      { id: `usage-backfill-${USAGE_MESSAGE_BACKFILL_ID}-session_message-500`, delay: 500 }
    );
  });

  it('ignores queued legacy message jobs so they cannot advance the revised cursor', async () => {
    await mocks.process({ source: 'session_message', cursor: '500' });

    expect(mocks.findMany).not.toHaveBeenCalled();
    expect(mocks.updateSource).not.toHaveBeenCalled();
  });

  it('does not advance the checkpoint after a failed write', async () => {
    mocks.findMany.mockResolvedValue([makeMessage(1, '2026-10-27T13:45:25Z')]);
    mocks.bulkWrite.mockRejectedValueOnce(new Error('write unavailable'));

    await expect(mocks.process(job)).rejects.toThrow('write unavailable');

    expect(mocks.updateSource).not.toHaveBeenCalled();
  });
});
