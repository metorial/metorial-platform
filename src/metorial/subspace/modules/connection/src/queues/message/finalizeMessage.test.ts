import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => {
  let handlerRef: { current: any } = { current: null };

  return {
    handlerRef,
    db: {
      sessionMessage: { findFirst: vi.fn() },
      sessionConnection: { updateMany: vi.fn() },
      sessionProvider: { updateMany: vi.fn() },
      session: { updateMany: vi.fn() },
      sessionUsageRecord: { create: vi.fn() }
    },
    protoGuardMessageQueue: { add: vi.fn() },
    createQueue: vi.fn(() => ({
      process: (handler: any) => {
        handlerRef.current = handler;
        return { handler };
      }
    }))
  };
});

vi.mock('@lowerdeck/queue', () => ({ createQueue: mocks.createQueue }));
vi.mock('@metorial-subspace/db', () => ({ db: mocks.db }));
vi.mock('../../env', () => ({ env: { service: { REDIS_URL: 'redis://localhost:6379' } } }));
vi.mock('./protoGuard', () => ({ protoGuardMessageQueue: mocks.protoGuardMessageQueue }));
vi.mock('uuid', () => ({ v7: () => 'usage_uuid' }));

import './finalizeMessage';

let message = (overrides: Record<string, unknown> = {}) => ({
  id: 'msg_1',
  oid: 500n,
  isProductive: true,
  source: 'client',
  connectionOid: 60n,
  sessionProviderOid: 70n,
  sessionOid: 1n,
  retentionLevel: 'full',
  hasOutput: true,
  output: { type: 'tool.result', data: {} },
  session: { tenantOid: 10n, projectOid: 11n, solutionOid: 30n },
  ...overrides
});

let run = (msg: any) => mocks.handlerRef.current({ messageId: msg.id });

describe('finalizeMessage usage accounting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.db.sessionConnection.updateMany.mockResolvedValue(undefined);
    mocks.db.sessionProvider.updateMany.mockResolvedValue(undefined);
    mocks.db.session.updateMany.mockResolvedValue(undefined);
    mocks.db.sessionUsageRecord.create.mockResolvedValue(undefined);
    mocks.protoGuardMessageQueue.add.mockResolvedValue(undefined);
  });

  it('records the same usage at none as at full', async () => {
    mocks.db.sessionMessage.findFirst.mockResolvedValue(message({ retentionLevel: 'full' }));
    await run(message());
    let atFull = mocks.db.sessionUsageRecord.create.mock.calls[0]![0].data;

    vi.clearAllMocks();
    mocks.db.sessionUsageRecord.create.mockResolvedValue(undefined);

    // Under zero data retention the payload is gone, but `hasOutput` is still true.
    mocks.db.sessionMessage.findFirst.mockResolvedValue(
      message({ retentionLevel: 'none', output: null })
    );
    await run(message());
    let atNone = mocks.db.sessionUsageRecord.create.mock.calls[0]![0].data;

    expect(atNone.clientMessageIncrement).toBe(atFull.clientMessageIncrement);
    expect(atNone.providerMessageIncrement).toBe(atFull.providerMessageIncrement);
    expect(atNone.providerMessageIncrement).toBe(1);
  });

  it('does not count a response that never arrived', async () => {
    mocks.db.sessionMessage.findFirst.mockResolvedValue(
      message({ retentionLevel: 'none', output: null, hasOutput: false })
    );

    await run(message());

    let { data } = mocks.db.sessionUsageRecord.create.mock.calls[0]![0];
    expect(data.clientMessageIncrement).toBe(1);
    expect(data.providerMessageIncrement).toBe(0);
  });

  it('counts legacy rows written before hasOutput existed', async () => {
    // Backfilled to the column default while carrying a real payload.
    mocks.db.sessionMessage.findFirst.mockResolvedValue(
      message({ hasOutput: false, output: { type: 'tool.result', data: {} } })
    );

    await run(message());

    let { data } = mocks.db.sessionUsageRecord.create.mock.calls[0]![0];
    expect(data.providerMessageIncrement).toBe(1);
  });

  it('runs ProtoGuard only at full', async () => {
    mocks.db.sessionMessage.findFirst.mockResolvedValue(message({ retentionLevel: 'full' }));
    await run(message());
    expect(mocks.protoGuardMessageQueue.add).toHaveBeenCalledWith({ messageId: 'msg_1' });

    for (let level of ['intent_only', 'none']) {
      vi.clearAllMocks();
      mocks.db.sessionUsageRecord.create.mockResolvedValue(undefined);
      mocks.db.sessionMessage.findFirst.mockResolvedValue(
        message({ retentionLevel: level, output: null })
      );

      await run(message());
      expect(mocks.protoGuardMessageQueue.add).not.toHaveBeenCalled();
    }
  });
});
