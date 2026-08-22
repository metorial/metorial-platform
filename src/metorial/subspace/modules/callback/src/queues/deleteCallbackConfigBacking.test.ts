import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  processor: null as null | ((data: { callbackConfigVersionId: string }) => Promise<void>),
  versionFindUnique: vi.fn(),
  versionUpdate: vi.fn(),
  mirrorDeleteMany: vi.fn(),
  deleteCallbackConfig: vi.fn()
}));

vi.mock('@lowerdeck/queue', () => ({
  QueueRetryError: class QueueRetryError extends Error {},
  createQueue: vi.fn(() => ({
    process: vi.fn(
      (processor: (data: { callbackConfigVersionId: string }) => Promise<void>) => {
        mocks.processor = processor;
        return processor;
      }
    )
  }))
}));

vi.mock('@metorial-subspace/db', () => ({
  db: {
    callbackConfigVersion: { findUnique: mocks.versionFindUnique },
    $transaction: vi.fn(
      async callback =>
        await callback({
          callbackConfigVersion: {
            findUnique: mocks.versionFindUnique,
            update: mocks.versionUpdate
          },
          slateCallbackConfig: { deleteMany: mocks.mirrorDeleteMany }
        })
    )
  }
}));

vi.mock('@metorial-subspace/provider', () => ({
  getBackend: vi.fn(async () => ({
    callbackConfig: { deleteCallbackConfig: mocks.deleteCallbackConfig }
  }))
}));

vi.mock('../env', () => ({ env: { service: { REDIS_URL: 'redis://test' } } }));

import './deleteCallbackConfigBacking';

let version = (currentVersionOid: bigint | null, slateCallbackConfigOid: bigint | null) => ({
  oid: 10n,
  id: 'cbcfgv_1',
  backendOid: 20n,
  slateCallbackConfigOid,
  callbackConfig: {
    currentVersionOid,
    tenant: { oid: 30n }
  },
  slateCallbackConfig: slateCallbackConfigOid ? { oid: slateCallbackConfigOid } : null
});

describe('callback config backing deletion', () => {
  beforeEach(() => vi.clearAllMocks());

  it('never deletes the current backing', async () => {
    mocks.versionFindUnique.mockResolvedValue(version(10n, 40n));

    await mocks.processor!({ callbackConfigVersionId: 'cbcfgv_1' });

    expect(mocks.deleteCallbackConfig).not.toHaveBeenCalled();
    expect(mocks.versionUpdate).not.toHaveBeenCalled();
  });

  it('converges when a completed deletion job is replayed', async () => {
    mocks.versionFindUnique
      .mockResolvedValueOnce(version(11n, 40n))
      .mockResolvedValueOnce(version(11n, 40n))
      .mockResolvedValueOnce(version(11n, null));

    await mocks.processor!({ callbackConfigVersionId: 'cbcfgv_1' });
    await mocks.processor!({ callbackConfigVersionId: 'cbcfgv_1' });

    expect(mocks.deleteCallbackConfig).toHaveBeenCalledTimes(1);
    expect(mocks.versionUpdate).toHaveBeenCalledTimes(1);
    expect(mocks.mirrorDeleteMany).toHaveBeenCalledWith({ where: { oid: 40n } });
  });
});
