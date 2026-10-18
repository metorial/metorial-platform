import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => {
  let handlerRef: { current: any } = { current: null };

  return {
    handlerRef,
    db: {
      sessionMessage: { findUnique: vi.fn(), updateMany: vi.fn() },
      instance: { findUnique: vi.fn() },
      sessionConnection: { updateMany: vi.fn() },
      sessionProvider: { updateMany: vi.fn() },
      session: { updateMany: vi.fn() }
    },
    protoGuardMessageQueue: { add: vi.fn() },
    fabricFire: vi.fn(),
    createQueue: vi.fn(() => ({
      process: (handler: any) => {
        handlerRef.current = handler;
        return { handler };
      }
    }))
  };
});

vi.mock('@lowerdeck/queue', () => ({ createQueue: mocks.createQueue }));
vi.mock('@metorial-subspace/db', () => ({
  db: mocks.db,
  dbPrimary: mocks.db,
  withTransaction: (cb: (db: unknown) => unknown) => cb(mocks.db)
}));
vi.mock('@metorial/fabric', () => ({ Fabric: { fire: mocks.fabricFire } }));
vi.mock('../../env', () => ({ env: { service: { REDIS_URL: 'redis://localhost:6379' } } }));
vi.mock('./protoGuard', () => ({ protoGuardMessageQueue: mocks.protoGuardMessageQueue }));

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
  type: 'tool_call',
  methodOrToolKey: 'search',
  activityCountedAt: null,
  hasOutput: true,
  output: { type: 'tool.result', data: {} },
  session: { id: 'ses_1', tenantOid: 10n, projectOid: 11n, solutionOid: 30n },
  instanceOid: 3n,
  senderParticipant: { id: 'spa_1', type: 'agent', name: 'Client' },
  sessionProvider: null,
  connection: null,
  toolCall: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  completedAt: new Date('2026-01-01T00:00:01Z'),
  ...overrides
});

let run = (msg: any) => mocks.handlerRef.current({ messageId: msg.id });

describe('finalizeMessage usage accounting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.db.sessionConnection.updateMany.mockResolvedValue(undefined);
    mocks.db.sessionProvider.updateMany.mockResolvedValue(undefined);
    mocks.db.session.updateMany.mockResolvedValue(undefined);
    mocks.db.sessionMessage.updateMany.mockResolvedValue({ count: 1 });
    mocks.fabricFire.mockResolvedValue(undefined);
    mocks.protoGuardMessageQueue.add.mockResolvedValue(undefined);
    // No mirror row: the audit entry resolves no scope and is skipped, which keeps these
    // usage-accounting cases focused on accounting.
    mocks.db.instance.findUnique.mockResolvedValue(null);
  });

  it('records the same usage at none as at full', async () => {
    mocks.db.sessionMessage.findUnique.mockResolvedValue(message({ retentionLevel: 'full' }));
    await run(message());
    let atFull = mocks.fabricFire.mock.calls[0]![1];

    vi.clearAllMocks();
    mocks.fabricFire.mockResolvedValue(undefined);
    mocks.db.sessionMessage.updateMany.mockResolvedValue({ count: 1 });

    // Under zero data retention the payload is gone, but `hasOutput` is still true.
    mocks.db.sessionMessage.findUnique.mockResolvedValue(
      message({ retentionLevel: 'none', output: null })
    );
    await run(message());
    let atNone = mocks.fabricFire.mock.calls[0]![1];

    expect(atNone.clientMessageIncrement).toBe(atFull.clientMessageIncrement);
    expect(atNone.providerMessageIncrement).toBe(atFull.providerMessageIncrement);
    expect(atNone.providerMessageIncrement).toBe(1);
  });

  it('does not count a response that never arrived', async () => {
    mocks.db.sessionMessage.findUnique.mockResolvedValue(
      message({ retentionLevel: 'none', output: null, hasOutput: false })
    );

    await run(message());

    let [event, data] = mocks.fabricFire.mock.calls[0]!;
    expect(event).toBe('provider.session_message.usage:after');
    expect(data.clientMessageIncrement).toBe(1);
    expect(data.providerMessageIncrement).toBe(0);
  });

  it('counts legacy rows written before hasOutput existed', async () => {
    // Backfilled to the column default while carrying a real payload.
    mocks.db.sessionMessage.findUnique.mockResolvedValue(
      message({ hasOutput: false, output: { type: 'tool.result', data: {} } })
    );

    await run(message());

    let data = mocks.fabricFire.mock.calls[0]![1];
    expect(data.providerMessageIncrement).toBe(1);
  });

  it('does not report usage when the message has no instance', async () => {
    mocks.db.sessionMessage.findUnique.mockResolvedValue(message({ instanceOid: null }));

    await run(message());

    expect(mocks.fabricFire).not.toHaveBeenCalled();
  });

  it('runs ProtoGuard only at full', async () => {
    mocks.db.sessionMessage.findUnique.mockResolvedValue(message({ retentionLevel: 'full' }));
    await run(message());
    expect(mocks.protoGuardMessageQueue.add).toHaveBeenCalledWith(
      { messageId: 'msg_1' },
      { id: 'msg_1' }
    );

    for (let level of ['intent_only', 'none']) {
      vi.clearAllMocks();
      mocks.fabricFire.mockResolvedValue(undefined);
      mocks.db.sessionMessage.updateMany.mockResolvedValue({ count: 1 });
      mocks.db.sessionMessage.findUnique.mockResolvedValue(
        message({ retentionLevel: level, output: null })
      );

      await run(message());
      expect(mocks.protoGuardMessageQueue.add).not.toHaveBeenCalled();
    }
  });

  it('stores list and control messages but skips ProtoGuard for them', async () => {
    for (let method of ['tools/list', 'initialize', 'ping', 'notifications/initialized']) {
      vi.clearAllMocks();
      mocks.fabricFire.mockResolvedValue(undefined);
      mocks.db.sessionMessage.updateMany.mockResolvedValue({ count: 1 });
      mocks.db.sessionMessage.findUnique.mockResolvedValue(
        message({ methodOrToolKey: method })
      );

      await run(message());
      expect(mocks.protoGuardMessageQueue.add).not.toHaveBeenCalled();
    }

    vi.clearAllMocks();
    mocks.fabricFire.mockResolvedValue(undefined);
    mocks.db.sessionMessage.updateMany.mockResolvedValue({ count: 1 });
    mocks.db.sessionMessage.findUnique.mockResolvedValue(
      message({ methodOrToolKey: 'resources/read' })
    );

    await run(message());
    expect(mocks.protoGuardMessageQueue.add).toHaveBeenCalled();
  });

  it('still runs ProtoGuard for a tool that shares a control method name', async () => {
    mocks.db.sessionMessage.findUnique.mockResolvedValue(
      message({ methodOrToolKey: 'ping', toolCall: { id: 'tcl_1', tool: { key: 'ping' } } })
    );

    await run(message());

    expect(mocks.protoGuardMessageQueue.add).toHaveBeenCalled();
  });

  it('does nothing when another run already finalized the message', async () => {
    mocks.db.sessionMessage.updateMany.mockResolvedValueOnce({ count: 0 });

    await run(message());

    expect(mocks.db.sessionMessage.findUnique).not.toHaveBeenCalled();
    expect(mocks.db.session.updateMany).not.toHaveBeenCalled();
    expect(mocks.fabricFire).not.toHaveBeenCalled();
  });

  it('adds only the response counters when creation was already counted', async () => {
    mocks.db.sessionMessage.findUnique.mockResolvedValue(
      message({ activityCountedAt: new Date('2026-01-01T00:00:00Z') })
    );

    await run(message());

    let sessionUpdate = mocks.db.session.updateMany.mock.calls[0]![0];
    expect(sessionUpdate.data.totalProductiveClientMessageCount).toBeUndefined();
    expect(sessionUpdate.data.totalProductiveProviderMessageCount).toEqual({ increment: 1 });
    expect(sessionUpdate.data.lastActiveAt).toBeUndefined();
  });

  it('releases the finalize claim when finalizing fails', async () => {
    mocks.db.sessionMessage.findUnique.mockRejectedValue(new Error('db down'));

    await expect(run(message())).rejects.toThrow('db down');

    expect(mocks.db.sessionMessage.updateMany).toHaveBeenLastCalledWith({
      where: { id: 'msg_1' },
      data: { finalizedAt: null }
    });
  });

  it('keeps the finalize claim once usage was recorded so a retry cannot count it twice', async () => {
    mocks.db.sessionMessage.findUnique.mockResolvedValue(message());
    mocks.fabricFire.mockRejectedValue(new Error('fabric down'));

    await expect(run(message())).rejects.toThrow('fabric down');

    expect(mocks.db.sessionMessage.updateMany).not.toHaveBeenCalledWith({
      where: { id: 'msg_1' },
      data: { finalizedAt: null }
    });
  });
});
