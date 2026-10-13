import { beforeEach, describe, expect, it, vi } from 'vitest';

let { mockDb } = vi.hoisted(() => ({
  mockDb: {
    integrationEnclave: {
      findFirst: vi.fn(),
      create: vi.fn()
    },
    integrationEnclaveEnvironment: {
      findFirst: vi.fn(),
      upsert: vi.fn()
    },
    integrationInternetGateway: {
      findFirst: vi.fn(),
      upsert: vi.fn()
    }
  }
}));

vi.mock('@metorial-subspace/db', () => ({
  Prisma: {
    JsonNull: Symbol('JsonNull')
  },
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

vi.mock('@metorial-subspace/module-catalog', () => ({
  providerTypeService: {
    getProviderTypeByOid: vi.fn(async () => ({
      attributes: { backend: 'slates' }
    }))
  }
}));

vi.mock('../queues/lifecycle/enclave', () => ({
  enclaveCreatedQueue: { add: vi.fn() }
}));

vi.mock('./integrationInternetGatewayInternal', () => ({
  integrationInternetGatewayInternalService: {
    ensureInternetGatewayForEnvironment: vi.fn(async () => {
      let existing = await mockDb.integrationInternetGateway.findFirst({
        where: {}
      });
      if (existing) return existing;

      return mockDb.integrationInternetGateway.upsert({
        where: {},
        update: {},
        create: {
          oid: BigInt(55),
          id: 'net_test_id',
          name: 'Metorial Magic Network'
        }
      });
    })
  }
}));

vi.mock('@lowerdeck/id', () => ({
  generatePlainId: () => 'ABCDEFGHIJ'
}));

vi.mock('@lowerdeck/slugify', () => ({
  slugify: (value: string) => value.toLowerCase().replace(/\s+/g, '-')
}));

import { integrationEnclaveInternalService } from './integrationEnclaveInternal';

let tenant = {
  oid: BigInt(10),
  id: 'ktn_test_tenant',
  projectOid: BigInt(11)
} as any;

let environment = {
  oid: BigInt(20),
  instanceOid: BigInt(21)
} as any;

let provider = {
  oid: BigInt(30),
  typeOid: 1,
  name: 'My Provider'
} as any;

let providerDeployment = {
  oid: BigInt(40),
  id: 'pde_test_deployment',
  isEphemeral: false
} as any;

describe('integrationEnclaveInternalService.ensureEnclaveForProviderDeployment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null for ephemeral deployments without creating rows', async () => {
    let result = await integrationEnclaveInternalService.ensureEnclaveForProviderDeployment({
      tenant,
      environment,
      provider,
      providerDeployment: { ...providerDeployment, isEphemeral: true }
    });

    expect(result).toBeNull();
    expect(mockDb.integrationEnclave.create).not.toHaveBeenCalled();
    expect(mockDb.integrationEnclaveEnvironment.upsert).not.toHaveBeenCalled();
  });

  it('returns an existing enclave without creating a new one', async () => {
    let existing = { oid: BigInt(99), id: 'enc_existing' };
    mockDb.integrationEnclave.findFirst.mockResolvedValueOnce(existing);

    let result = await integrationEnclaveInternalService.ensureEnclaveForProviderDeployment({
      tenant,
      environment,
      provider,
      providerDeployment
    });

    expect(result).toBe(existing);
    expect(mockDb.integrationEnclave.create).not.toHaveBeenCalled();
  });

  it('creates system enclave environment and enclave for a new deployment', async () => {
    mockDb.integrationEnclave.findFirst.mockResolvedValueOnce(null);
    mockDb.integrationEnclaveEnvironment.findFirst.mockResolvedValueOnce(null);
    mockDb.integrationInternetGateway.findFirst.mockResolvedValueOnce(null);
    mockDb.integrationInternetGateway.upsert.mockResolvedValueOnce({
      oid: BigInt(55),
      id: 'net_test_id'
    });
    mockDb.integrationEnclaveEnvironment.upsert.mockResolvedValueOnce({
      oid: BigInt(50),
      id: 'een_test_id',
      systemIdentifier: `system:${tenant.id}`
    });
    mockDb.integrationEnclave.create.mockResolvedValueOnce({
      oid: BigInt(60),
      id: 'enc_test_id',
      slug: 'my-provider-abcdefghij',
      name: 'My Provider',
      description: ''
    });

    let result = await integrationEnclaveInternalService.ensureEnclaveForProviderDeployment({
      tenant,
      environment,
      provider,
      providerDeployment
    });

    expect(mockDb.integrationEnclaveEnvironment.upsert).toHaveBeenCalledWith({
      where: { systemIdentifier: `system:${tenant.id}` },
      update: {
        name: `Metorial Platform`,
        type: 'metorial'
      },
      create: expect.objectContaining({
        name: `Metorial Platform`,
        type: 'metorial',
        systemIdentifier: `system:${tenant.id}`,
        tenantOid: tenant.oid,
        projectOid: tenant.projectOid
      })
    });

    expect(mockDb.integrationEnclave.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        slug: 'my-provider-abcdefghij',
        name: 'My Provider',
        description: '',
        providerDeploymentOid: providerDeployment.oid,
        tenantOid: tenant.oid,
        projectOid: tenant.projectOid,
        environmentOid: environment.oid,
        instanceOid: environment.instanceOid,
        internetGatewayOid: BigInt(55),
        enclaveEnvironmentOid: BigInt(50),
        needsEnclaveReconciliation: true
      })
    });

    expect(result).toMatchObject({
      slug: 'my-provider-abcdefghij',
      name: 'My Provider',
      description: ''
    });
  });

  it('reuses an existing system enclave environment for the tenant', async () => {
    mockDb.integrationEnclave.findFirst.mockResolvedValueOnce(null);
    mockDb.integrationEnclaveEnvironment.findFirst.mockResolvedValueOnce({
      oid: BigInt(70),
      id: 'een_existing',
      systemIdentifier: `system:${tenant.id}`
    });
    mockDb.integrationInternetGateway.findFirst.mockResolvedValueOnce({
      oid: BigInt(55),
      id: 'net_existing'
    });
    mockDb.integrationEnclave.create.mockResolvedValueOnce({
      oid: BigInt(80),
      id: 'enc_new'
    });

    await integrationEnclaveInternalService.ensureEnclaveForProviderDeployment({
      tenant,
      environment,
      provider,
      providerDeployment
    });

    expect(mockDb.integrationEnclaveEnvironment.upsert).not.toHaveBeenCalled();
    expect(mockDb.integrationEnclave.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        enclaveEnvironmentOid: BigInt(70),
        internetGatewayOid: BigInt(55)
      })
    });
  });

  it('writes null mirrored oids for an unlinked tenant and environment', async () => {
    mockDb.integrationEnclave.findFirst.mockResolvedValueOnce(null);
    mockDb.integrationEnclaveEnvironment.findFirst.mockResolvedValueOnce(null);
    mockDb.integrationInternetGateway.findFirst.mockResolvedValueOnce(null);
    mockDb.integrationInternetGateway.upsert.mockResolvedValueOnce({
      oid: BigInt(55),
      id: 'net_test_id'
    });
    mockDb.integrationEnclaveEnvironment.upsert.mockResolvedValueOnce({
      oid: BigInt(50),
      id: 'een_test_id'
    });
    mockDb.integrationEnclave.create.mockResolvedValueOnce({
      oid: BigInt(60),
      id: 'enc_test_id'
    });

    await integrationEnclaveInternalService.ensureEnclaveForProviderDeployment({
      tenant: { oid: BigInt(10), id: 'ktn_test_tenant', projectOid: null } as any,
      environment: { oid: BigInt(20), instanceOid: null } as any,
      provider,
      providerDeployment
    });

    expect(mockDb.integrationEnclaveEnvironment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          tenantOid: BigInt(10),
          projectOid: null
        })
      })
    );
    expect(mockDb.integrationEnclave.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantOid: BigInt(10),
        projectOid: null,
        environmentOid: BigInt(20),
        instanceOid: null
      })
    });
  });
});
