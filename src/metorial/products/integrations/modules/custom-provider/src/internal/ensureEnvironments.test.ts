import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  db: {
    customProvider: { findUniqueOrThrow: vi.fn() },
    environment: { findMany: vi.fn() },
    customProviderEnvironment: { createMany: vi.fn(), findMany: vi.fn() }
  }
}));

vi.mock('@metorial-subspace/db', () => ({
  db: mocks.db,
  getId: (name: string) => ({ oid: 1n, id: `${name}_test` }),
  withTransaction: (fn: any) => fn(mocks.db)
}));

import { ensureEnvironments } from './ensureEnvironments';

let customProvider = {
  oid: 10n,
  tenantOid: 20n,
  projectOid: 21n,
  solutionOid: 1
};

describe('ensureEnvironments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.db.customProvider.findUniqueOrThrow.mockResolvedValue(customProvider);
    mocks.db.customProviderEnvironment.createMany.mockResolvedValue({ count: 2 });
    mocks.db.customProviderEnvironment.findMany.mockResolvedValue([]);
  });

  it('mirrors the project from the custom provider and the instance from each environment', async () => {
    mocks.db.environment.findMany.mockResolvedValue([
      { oid: 30n, instanceOid: 31n },
      { oid: 40n, instanceOid: 41n }
    ]);

    await ensureEnvironments({ customProviderOid: 10n });

    expect(mocks.db.customProviderEnvironment.createMany).toHaveBeenCalledWith({
      skipDuplicates: true,
      data: [
        expect.objectContaining({
          tenantOid: 20n,
          projectOid: 21n,
          environmentOid: 30n,
          instanceOid: 31n
        }),
        expect.objectContaining({
          tenantOid: 20n,
          projectOid: 21n,
          environmentOid: 40n,
          instanceOid: 41n
        })
      ]
    });
  });

  it('writes null rather than a fabricated oid for unlinked tenants and environments', async () => {
    mocks.db.customProvider.findUniqueOrThrow.mockResolvedValue({
      ...customProvider,
      projectOid: null
    });
    mocks.db.environment.findMany.mockResolvedValue([{ oid: 30n, instanceOid: null }]);

    await ensureEnvironments({ customProviderOid: 10n });

    let [call] = mocks.db.customProviderEnvironment.createMany.mock.calls;
    expect(call![0].data).toEqual([
      expect.objectContaining({
        tenantOid: 20n,
        projectOid: null,
        environmentOid: 30n,
        instanceOid: null
      })
    ]);
  });

  it('mirrors a per-environment instance independently of the others', async () => {
    mocks.db.environment.findMany.mockResolvedValue([
      { oid: 30n, instanceOid: 31n },
      { oid: 40n, instanceOid: null }
    ]);

    await ensureEnvironments({ customProviderOid: 10n });

    let [call] = mocks.db.customProviderEnvironment.createMany.mock.calls;
    expect(call![0].data.map((row: any) => row.instanceOid)).toEqual([31n, null]);
  });

  it('keeps filtering environments on the legacy tenant column only', async () => {
    mocks.db.environment.findMany.mockResolvedValue([]);

    await ensureEnvironments({ customProviderOid: 10n });

    expect(mocks.db.environment.findMany).toHaveBeenCalledWith({
      where: { tenantOid: 20n }
    });
    expect(mocks.db.customProviderEnvironment.createMany).toHaveBeenCalledWith({
      skipDuplicates: true,
      data: []
    });
  });
});
