import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  db: {
    customProviderCommit: {
      findFirst: vi.fn(),
      findFirstOrThrow: vi.fn(),
      updateMany: vi.fn()
    },
    customProviderEnvironment: { updateMany: vi.fn() },
    customProviderEnvironmentVersion: { upsert: vi.fn() },
    providerEnvironment: { upsert: vi.fn() },
    providerEnvironmentVersion: { upsert: vi.fn() },
    providerVersion: { updateMany: vi.fn() },
    providerVariant: { updateMany: vi.fn() },
    provider: { updateMany: vi.fn() }
  },
  queueAdd: vi.fn()
}));

vi.mock('@lowerdeck/queue', () => ({
  createQueue: () => ({
    add: mocks.queueAdd,
    process: (handler: any) => handler
  }),
  QueueRetryError: class QueueRetryError extends Error {}
}));

vi.mock('@lowerdeck/lock', () => ({
  createLock: () => ({
    usingLock: (_key: string, fn: any) => fn()
  })
}));

vi.mock('@metorial-subspace/db', () => ({
  db: mocks.db,
  getId: (name: string) => ({ oid: 1n, id: `${name}_test` }),
  withTransaction: (fn: any) => fn(mocks.db)
}));

vi.mock('../../env', () => ({
  env: { service: { REDIS_URL: 'redis://localhost:6379' } }
}));

import { commitApplyQueueProcessor } from './apply';

let customProvider = {
  id: 'kcp_1',
  status: 'active',
  providerOid: 200n,
  providerVariantOid: 201n
};

let makeCommit = (overrides: Record<string, unknown> = {}) => ({
  oid: 90n,
  toEnvironmentOid: 80n,
  customProvider,
  targetCustomProviderVersion: {
    oid: 60n,
    status: 'deployment_succeeded',
    providerVersionOid: 300n
  },
  toEnvironment: {
    oid: 80n,
    tenantOid: 20n,
    projectOid: 21n,
    solutionOid: 1,
    environmentOid: 30n,
    instanceOid: 31n,
    environment: { oid: 30n, instanceOid: 31n },
    ...((overrides.toEnvironment as Record<string, unknown>) ?? {})
  }
});

let runProcessor = () =>
  (commitApplyQueueProcessor as any)({ customProviderCommitId: 'kcpc_1' });

describe('commit apply', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.db.customProviderCommit.findFirst.mockResolvedValue({
      oid: 90n,
      customProvider
    });
    mocks.db.customProviderCommit.findFirstOrThrow.mockResolvedValue(makeCommit());
    mocks.db.providerEnvironment.upsert.mockResolvedValue({ oid: 400n });
    mocks.db.providerEnvironmentVersion.upsert.mockResolvedValue({ oid: 401n });
    mocks.db.customProviderEnvironmentVersion.upsert.mockResolvedValue({ oid: 402n });
  });

  it('copies the mirrored columns from the already loaded custom provider environment', async () => {
    await runProcessor();

    expect(mocks.db.providerEnvironment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          environmentOid: 30n,
          instanceOid: 31n,
          tenantOid: 20n,
          projectOid: 21n
        })
      })
    );
    expect(mocks.db.customProviderEnvironmentVersion.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ environmentOid: 30n, instanceOid: 31n })
      })
    );
  });

  it('mirrors the instance onto the provider environment version', async () => {
    await runProcessor();

    expect(mocks.db.providerEnvironmentVersion.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ environmentOid: 30n, instanceOid: 31n })
      })
    );
  });

  it('writes null when the environment has no instance and the tenant has no project', async () => {
    mocks.db.customProviderCommit.findFirstOrThrow.mockResolvedValue(
      makeCommit({
        toEnvironment: {
          projectOid: null,
          instanceOid: null,
          environment: { oid: 30n, instanceOid: null }
        }
      })
    );

    await runProcessor();

    expect(mocks.db.providerEnvironment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          tenantOid: 20n,
          projectOid: null,
          environmentOid: 30n,
          instanceOid: null
        })
      })
    );
    expect(mocks.db.customProviderEnvironmentVersion.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ instanceOid: null })
      })
    );
  });

  it('keeps the provider environment upsert keyed on the legacy environment column', async () => {
    await runProcessor();

    let [call] = mocks.db.providerEnvironment.upsert.mock.calls;
    expect(call![0].where).toEqual({
      environmentOid_providerOid: {
        environmentOid: 30n,
        providerOid: 200n
      }
    });
  });
});
