import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  sessionProviderFindUniqueOrThrow: vi.fn(),
  providerUseUpsert: vi.fn()
}));

vi.mock('@lowerdeck/queue', () => ({
  createQueue: vi.fn(() => ({
    add: vi.fn(),
    process: vi.fn(handler => handler)
  }))
}));

vi.mock('@metorial-subspace/db', () => ({
  db: {
    sessionProvider: { findUniqueOrThrow: mocks.sessionProviderFindUniqueOrThrow },
    providerUse: { upsert: mocks.providerUseUpsert }
  },
  getId: vi.fn((prefix: string) => ({ oid: 1n, id: `${prefix}_1` }))
}));

vi.mock('../../env', () => ({
  env: { service: { REDIS_URL: 'redis://localhost:6379' } }
}));

import { sessionProviderCreatedQueueProcessor } from './sessionProvider';

let linkedSessionProvider = {
  id: 'sp_1',
  tenantOid: 10n,
  projectOid: 20n,
  solutionOid: 7,
  environmentOid: 30n,
  instanceOid: 40n,
  providerOid: 51n
};

describe('sessionProviderCreatedQueueProcessor double writes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.providerUseUpsert.mockResolvedValue({});
  });

  it('copies the mirrored references off the session provider row', async () => {
    mocks.sessionProviderFindUniqueOrThrow.mockResolvedValue(linkedSessionProvider);

    await (sessionProviderCreatedQueueProcessor as any)({ sessionProviderId: 'sp_1' });

    let [{ create }] = mocks.providerUseUpsert.mock.calls[0]!;

    expect(create).toMatchObject({
      tenantOid: 10n,
      projectOid: 20n,
      environmentOid: 30n,
      instanceOid: 40n,
      providerOid: 51n
    });
  });

  it('leaves the legacy composite lookup key untouched', async () => {
    mocks.sessionProviderFindUniqueOrThrow.mockResolvedValue(linkedSessionProvider);

    await (sessionProviderCreatedQueueProcessor as any)({ sessionProviderId: 'sp_1' });

    let [{ where, update }] = mocks.providerUseUpsert.mock.calls[0]!;

    expect(where).toEqual({
      tenantOid_solutionOid_environmentOid_providerOid: {
        tenantOid: 10n,
        solutionOid: 7,
        environmentOid: 30n,
        providerOid: 51n
      }
    });
    expect(update).not.toHaveProperty('projectOid');
    expect(update).not.toHaveProperty('instanceOid');
  });

  it('carries a null reference through instead of fabricating one', async () => {
    mocks.sessionProviderFindUniqueOrThrow.mockResolvedValue({
      ...linkedSessionProvider,
      projectOid: null,
      instanceOid: null
    });

    await (sessionProviderCreatedQueueProcessor as any)({ sessionProviderId: 'sp_1' });

    let [{ create }] = mocks.providerUseUpsert.mock.calls[0]!;

    expect(create.projectOid).toBeNull();
    expect(create.instanceOid).toBeNull();
  });
});
