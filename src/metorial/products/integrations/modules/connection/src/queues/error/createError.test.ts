import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  recordSessionError: vi.fn(),
  handler: null as unknown as (data: { errorId: string }) => Promise<void>,
  db: {
    sessionError: { findFirst: vi.fn(), updateMany: vi.fn() },
    session: { updateMany: vi.fn() },
    sessionConnection: { updateMany: vi.fn() },
    sessionErrorGroup: { findUnique: vi.fn(), upsert: vi.fn(), updateMany: vi.fn() },
    sessionErrorGroupOccurrencePeriod: { upsert: vi.fn(), update: vi.fn() },
    sessionEvent: { createMany: vi.fn() }
  }
}));

vi.mock('@lowerdeck/queue', () => ({
  QueueRetryError: class extends Error {},
  createQueue: () => ({
    process: (handler: typeof mocks.handler) => {
      mocks.handler = handler;
      return { handler };
    }
  })
}));

vi.mock('@metorial-subspace/db', () => ({
  db: mocks.db,
  getId: () => ({ id: 'generated', oid: 100n }),
  snowflake: { nextId: () => 101n }
}));

vi.mock('@metorial-subspace/module-provider-issue', () => ({
  providerIssueRecorderService: { recordSessionError: mocks.recordSessionError }
}));

vi.mock('@metorial/db', () => import('../../../../../../../db/src/lib/unique'));

vi.mock('@lowerdeck/hash', () => ({ Hash: { sha256: async () => 'error-hash' } }));

vi.mock('../../env', () => ({ env: { service: { REDIS_URL: 'redis://localhost:6379' } } }));

import './createError';

let group = { oid: 50n, id: 'seg_existing' };

let groupWhere = {
  type_hash_tenantOid: {
    type: 'provider_discovery_failed',
    hash: 'error-hash',
    tenantOid: 2n
  }
};

describe('createError', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.db.sessionError.findFirst.mockResolvedValue({
      id: 'ser_1',
      oid: 9n,
      type: 'provider_discovery_failed',
      code: 'discovery_failed',
      message: 'Discovery failed',
      sessionOid: 1n,
      tenantOid: 2n,
      session: { tenantOid: 2n, hasErrors: false },
      connection: null,
      providerRun: null
    });
    mocks.db.sessionErrorGroup.findUnique.mockResolvedValue(group);
    mocks.db.sessionErrorGroup.upsert.mockResolvedValue(group);
    mocks.db.sessionErrorGroupOccurrencePeriod.upsert.mockResolvedValue({ oid: 60n });
    mocks.db.sessionErrorGroupOccurrencePeriod.update.mockResolvedValue({ oid: 60n });
  });

  it.each([true, false])(
    'processes an error when the group already exists: %s',
    async exists => {
      mocks.db.sessionErrorGroup.findUnique.mockResolvedValue(exists ? group : null);

      await mocks.handler({ errorId: 'ser_1' });

      expect(mocks.recordSessionError).toHaveBeenCalledExactlyOnceWith({
        sessionErrorId: 'ser_1'
      });
      expect(mocks.db.sessionErrorGroup.upsert).toHaveBeenCalledTimes(exists ? 0 : 1);
      expect(mocks.db.sessionErrorGroupOccurrencePeriod.update).not.toHaveBeenCalled();
      expect(mocks.db.sessionError.updateMany).toHaveBeenCalledWith({
        where: { id: 'ser_1' },
        data: { isProcessing: false, groupOid: group.oid }
      });
    }
  );

  it('recovers the winning group after a concurrent creation', async () => {
    mocks.db.sessionErrorGroup.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(group);
    mocks.db.sessionErrorGroup.upsert.mockRejectedValueOnce(
      Object.assign(new Error('duplicate group'), { code: 'P2002' })
    );

    await mocks.handler({ errorId: 'ser_1' });

    expect(mocks.db.sessionErrorGroup.findUnique).toHaveBeenCalledTimes(2);
    expect(mocks.db.sessionErrorGroup.findUnique).toHaveBeenLastCalledWith({
      where: groupWhere
    });
    expect(mocks.db.sessionErrorGroupOccurrencePeriod.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ groupOid: group.oid, occurrenceCount: 1 })
      })
    );
    expect(mocks.db.sessionErrorGroup.updateMany).toHaveBeenCalledExactlyOnceWith({
      where: { oid: group.oid },
      data: { occurrenceCount: { increment: 1 } }
    });
    expect(mocks.db.sessionEvent.createMany).toHaveBeenCalledTimes(1);
    expect(mocks.db.sessionError.updateMany).toHaveBeenCalledWith({
      where: { id: 'ser_1' },
      data: { isProcessing: false, groupOid: group.oid }
    });
  });

  it.each(['P2002', 'P2003'])('preserves a group failure with code %s', async code => {
    let error = Object.assign(new Error('group failure'), { code });
    mocks.db.sessionErrorGroup.findUnique.mockResolvedValue(null);
    mocks.db.sessionErrorGroup.upsert.mockRejectedValueOnce(error);

    await expect(mocks.handler({ errorId: 'ser_1' })).rejects.toBe(error);

    expect(mocks.db.sessionErrorGroup.findUnique).toHaveBeenCalledTimes(
      code === 'P2002' ? 2 : 1
    );
    expect(mocks.db.sessionErrorGroupOccurrencePeriod.upsert).not.toHaveBeenCalled();
    expect(mocks.db.sessionError.updateMany).not.toHaveBeenCalled();
  });

  it('increments the winning daily period after a concurrent creation', async () => {
    mocks.db.sessionErrorGroupOccurrencePeriod.upsert.mockRejectedValueOnce(
      Object.assign(new Error('duplicate period'), { code: 'P2002' })
    );

    await mocks.handler({ errorId: 'ser_1' });

    let upsert = mocks.db.sessionErrorGroupOccurrencePeriod.upsert.mock.calls[0]![0];

    expect(mocks.db.sessionErrorGroupOccurrencePeriod.update).toHaveBeenCalledExactlyOnceWith({
      where: upsert.where,
      data: { occurrenceCount: { increment: 1 } }
    });
    expect(mocks.db.sessionErrorGroup.updateMany).toHaveBeenCalledTimes(1);
    expect(mocks.db.sessionEvent.createMany).toHaveBeenCalledTimes(1);
  });

  it('preserves a period conflict when no matching period exists', async () => {
    let error = Object.assign(new Error('unrelated oid collision'), { code: 'P2002' });
    mocks.db.sessionErrorGroupOccurrencePeriod.upsert.mockRejectedValueOnce(error);
    mocks.db.sessionErrorGroupOccurrencePeriod.update.mockRejectedValueOnce(
      Object.assign(new Error('missing period'), { code: 'P2025' })
    );

    await expect(mocks.handler({ errorId: 'ser_1' })).rejects.toBe(error);

    expect(mocks.db.sessionErrorGroup.updateMany).not.toHaveBeenCalled();
    expect(mocks.db.sessionEvent.createMany).not.toHaveBeenCalled();
  });

  it('propagates non-unique period failures without recovery', async () => {
    let error = Object.assign(new Error('foreign key failure'), { code: 'P2003' });
    mocks.db.sessionErrorGroupOccurrencePeriod.upsert.mockRejectedValueOnce(error);

    await expect(mocks.handler({ errorId: 'ser_1' })).rejects.toBe(error);

    expect(mocks.db.sessionErrorGroupOccurrencePeriod.update).not.toHaveBeenCalled();
    expect(mocks.db.sessionEvent.createMany).not.toHaveBeenCalled();
  });
});
