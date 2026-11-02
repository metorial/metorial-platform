import { beforeEach, describe, expect, it, vi } from 'vitest';
import { encodeUsageBucketKey } from '../src/lib/bucket';
import { USAGE_MESSAGE_BACKFILL_ID, USAGE_MESSAGE_REVISION } from '../src/lib/messageRevision';

let mocks = vi.hoisted(() => ({
  handlers: new Map<string, (data: any) => Promise<void>>(),
  getCutoff: vi.fn(),
  readBucket: vi.fn(),
  acknowledge: vi.fn(),
  bulkWrite: vi.fn()
}));

vi.mock('@metorial/cron', () => ({ createCron: () => ({}) }));

vi.mock('@metorial/queue', () => ({
  createQueue: ({ name }: { name: string }) => ({
    process: (handler: (data: any) => Promise<void>) => {
      mocks.handlers.set(name, handler);
      return {};
    }
  }),
  combineQueueProcessors: () => ({})
}));

vi.mock('../src/models', () => ({ UsageMetricModel: { bulkWrite: mocks.bulkWrite } }));

vi.mock('../src/lib/backfillState', () => ({ getUsageBackfillCutoff: mocks.getCutoff }));

vi.mock('../src/lib/connection', () => ({ usageDbConnect: async () => {} }));

vi.mock('../src/lib/buffer', () => ({
  parseClaimedUsageBucketKey: (key: string) => ({ minute: Number(key), nonce: 'nonce' }),
  readClaimedUsageBucket: mocks.readBucket,
  acknowledgeClaimedUsageBucket: mocks.acknowledge
}));

import '../src/queues/flush';

let originalCutoff = new Date('2026-10-22T12:00:00Z');

let messageCutoff = new Date('2026-11-01T06:30:00Z');

let run = (date: Date) =>
  mocks.handlers.get('usage/flush/bucket')!({ claimedKey: String(date.getTime()) });

describe('message rebuild and live usage boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCutoff.mockImplementation(async stateId =>
      stateId == USAGE_MESSAGE_BACKFILL_ID ? messageCutoff : originalCutoff
    );
    mocks.readBucket.mockResolvedValue(
      Object.fromEntries(
        ['tool_call', 'message', 'session'].map(kind => [
          `${encodeUsageBucketKey({ instanceId: 'ins_customer', kind: kind as any })}|c`,
          '3'
        ])
      )
    );
    mocks.bulkWrite.mockResolvedValue({});
  });

  it('lets history own older messages while retaining unrelated live metrics', async () => {
    await run(new Date('2026-10-30T13:05:00Z'));

    let documents = mocks.bulkWrite.mock.calls[0]![0].map(
      (operation: any) => operation.updateOne.update.$set
    );
    expect(documents).toHaveLength(1);
    expect(documents[0]).toMatchObject({ kind: 'session', count: 3 });
    expect(mocks.acknowledge).toHaveBeenCalled();
  });

  it('persists calls at the exact message cutoff once with the current revision', async () => {
    await run(messageCutoff);

    let documents = mocks.bulkWrite.mock.calls[0]![0].map(
      (operation: any) => operation.updateOne.update.$set
    );
    expect(documents).toHaveLength(3);
    expect(documents.filter((document: any) => document.kind != 'session')).toEqual([
      expect.objectContaining({
        kind: 'tool_call',
        count: 3,
        messageRevision: USAGE_MESSAGE_REVISION
      }),
      expect.objectContaining({
        kind: 'message',
        count: 3,
        messageRevision: USAGE_MESSAGE_REVISION
      })
    ]);
  });

  it('does not write any counters already covered by the original backfill', async () => {
    await run(new Date(originalCutoff.getTime() - 60_000));

    expect(mocks.bulkWrite).not.toHaveBeenCalled();
    expect(mocks.acknowledge).toHaveBeenCalled();
  });

  it('does not acknowledge a bucket when persistence fails', async () => {
    mocks.bulkWrite.mockRejectedValueOnce(new Error('write unavailable'));

    await expect(run(messageCutoff)).rejects.toThrow('write unavailable');

    expect(mocks.acknowledge).not.toHaveBeenCalled();
  });
});
