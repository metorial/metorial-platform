import { beforeEach, describe, expect, it, vi } from 'vitest';

let { mockDb } = vi.hoisted(() => ({
  mockDb: {
    integrationInternetGateway: {
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

vi.mock('../queues/lifecycle/internetGateway', () => ({
  internetGatewayCreatedQueue: { add: vi.fn() }
}));

import { integrationInternetGatewayInternalService } from './integrationInternetGatewayInternal';

let tenant = {
  oid: BigInt(10),
  id: 'ktn_test_tenant',
  projectOid: BigInt(11)
} as any;

let environment = {
  oid: BigInt(20),
  id: 'ken_test_environment',
  instanceOid: BigInt(21)
} as any;

describe('integrationInternetGatewayInternalService.ensureInternetGatewayForEnvironment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns an existing network without creating a new one', async () => {
    let existing = {
      oid: BigInt(30),
      id: 'net_existing',
      name: 'Metorial Magic Network'
    };
    mockDb.integrationInternetGateway.findFirst.mockResolvedValueOnce(existing);

    let result =
      await integrationInternetGatewayInternalService.ensureInternetGatewayForEnvironment({
        tenant,
        environment
      });

    expect(result).toBe(existing);
    expect(mockDb.integrationInternetGateway.upsert).not.toHaveBeenCalled();
  });

  it('creates the default network when missing', async () => {
    mockDb.integrationInternetGateway.findFirst.mockResolvedValueOnce(null);
    mockDb.integrationInternetGateway.upsert.mockResolvedValueOnce({
      oid: BigInt(40),
      id: 'net_new',
      name: 'Metorial Magic Network'
    });

    let result =
      await integrationInternetGatewayInternalService.ensureInternetGatewayForEnvironment({
        tenant,
        environment
      });

    expect(mockDb.integrationInternetGateway.upsert).toHaveBeenCalledWith({
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
        projectOid: tenant.projectOid,
        environmentOid: environment.oid,
        instanceOid: environment.instanceOid
      })
    });
    expect(result).toMatchObject({ name: 'Metorial Magic Network' });
  });

  it('writes null mirrored oids for an unlinked tenant and environment', async () => {
    mockDb.integrationInternetGateway.findFirst.mockResolvedValueOnce(null);
    mockDb.integrationInternetGateway.upsert.mockResolvedValueOnce({
      oid: BigInt(40),
      id: 'net_new'
    });

    await integrationInternetGatewayInternalService.ensureInternetGatewayForEnvironment({
      tenant: { oid: BigInt(10), id: 'ktn_test_tenant', projectOid: null } as any,
      environment: { oid: BigInt(20), id: 'ken_test_environment', instanceOid: null } as any
    });

    expect(mockDb.integrationInternetGateway.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          tenantOid: BigInt(10),
          projectOid: null,
          environmentOid: BigInt(20),
          instanceOid: null
        })
      })
    );
  });
});
