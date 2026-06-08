import { beforeEach, describe, expect, it, vi } from 'vitest';

let { mockDb } = vi.hoisted(() => ({
  mockDb: {
    network: {
      findFirst: vi.fn(),
      upsert: vi.fn()
    }
  }
}));

vi.mock('@metorial-subspace/db', () => ({
  withTransaction: async (
    cb: (db: typeof mockDb) => Promise<unknown>,
    opts?: { ifExists?: boolean }
  ) => {
    void opts;
    return cb(mockDb);
  },
  addAfterTransactionHook: async (cb: () => Promise<void>) => cb(),
  getId: (model: string) => ({
    oid: BigInt(1),
    id: `${model}_test_id`
  })
}));

vi.mock('../queues/lifecycle/network', () => ({
  networkCreatedQueue: { add: vi.fn() }
}));

import { networkInternalService } from './networkInternal';

let tenant = {
  oid: BigInt(10),
  id: 'ktn_test_tenant'
} as any;

let environment = {
  oid: BigInt(20),
  id: 'ken_test_environment'
} as any;

describe('networkInternalService.ensureNetworkForEnvironment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns an existing network without creating a new one', async () => {
    let existing = {
      oid: BigInt(30),
      id: 'net_existing',
      name: 'Metorial Magic Network'
    };
    mockDb.network.findFirst.mockResolvedValueOnce(existing);

    let result = await networkInternalService.ensureNetworkForEnvironment({
      tenant,
      environment
    });

    expect(result).toBe(existing);
    expect(mockDb.network.upsert).not.toHaveBeenCalled();
  });

  it('creates the default network when missing', async () => {
    mockDb.network.findFirst.mockResolvedValueOnce(null);
    mockDb.network.upsert.mockResolvedValueOnce({
      oid: BigInt(40),
      id: 'net_new',
      name: 'Metorial Magic Network'
    });

    let result = await networkInternalService.ensureNetworkForEnvironment({
      tenant,
      environment
    });

    expect(mockDb.network.upsert).toHaveBeenCalledWith({
      where: {
        tenantOid_environmentOid: {
          tenantOid: tenant.oid,
          environmentOid: environment.oid
        }
      },
      update: {
        name: 'Metorial Magic Network'
      },
      create: expect.objectContaining({
        name: 'Metorial Magic Network',
        tenantOid: tenant.oid,
        environmentOid: environment.oid
      })
    });
    expect(result).toMatchObject({ name: 'Metorial Magic Network' });
  });
});
