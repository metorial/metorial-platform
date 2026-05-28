import { beforeEach, describe, expect, it, vi } from 'vitest';

let mockDb = {
  enclave: {
    findFirst: vi.fn(),
    create: vi.fn()
  },
  enclaveEnvironment: {
    findFirst: vi.fn(),
    create: vi.fn()
  }
};

vi.mock('@metorial-subspace/db', async importOriginal => {
  let original = await importOriginal<typeof import('@metorial-subspace/db')>();

  return {
    ...original,
    db: mockDb,
    withTransaction: async (cb: (db: typeof mockDb) => Promise<unknown>, opts?: { ifExists?: boolean }) => {
      void opts;
      return cb(mockDb);
    },
    getId: (model: string) => ({
      oid: BigInt(1),
      id: `${model}_test_id`
    })
  };
});

vi.mock('@lowerdeck/id', () => ({
  generatePlainId: () => 'ABCDEFGHIJ'
}));

vi.mock('@lowerdeck/slugify', () => ({
  slugify: (value: string) => value.toLowerCase().replace(/\s+/g, '-')
}));

import { enclaveInternalService } from './enclaveInternal';

let tenant = {
  oid: BigInt(10),
  id: 'ktn_test_tenant'
} as any;

let solution = {
  oid: 1
} as any;

let environment = {
  oid: BigInt(20)
} as any;

let provider = {
  oid: BigInt(30),
  name: 'My Provider'
} as any;

let providerDeployment = {
  oid: BigInt(40),
  id: 'pde_test_deployment',
  isEphemeral: false
} as any;

describe('enclaveInternalService.ensureEnclaveForProviderDeployment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null for ephemeral deployments without creating rows', async () => {
    let result = await enclaveInternalService.ensureEnclaveForProviderDeployment({
      tenant,
      solution,
      environment,
      provider,
      providerDeployment: { ...providerDeployment, isEphemeral: true }
    });

    expect(result).toBeNull();
    expect(mockDb.enclave.create).not.toHaveBeenCalled();
    expect(mockDb.enclaveEnvironment.create).not.toHaveBeenCalled();
  });

  it('returns an existing enclave without creating a new one', async () => {
    let existing = { oid: BigInt(99), id: 'enc_existing' };
    mockDb.enclave.findFirst.mockResolvedValueOnce(existing);

    let result = await enclaveInternalService.ensureEnclaveForProviderDeployment({
      tenant,
      solution,
      environment,
      provider,
      providerDeployment
    });

    expect(result).toBe(existing);
    expect(mockDb.enclave.create).not.toHaveBeenCalled();
  });

  it('creates system enclave environment and enclave for a new deployment', async () => {
    mockDb.enclave.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    mockDb.enclaveEnvironment.findFirst.mockResolvedValueOnce(null);
    mockDb.enclaveEnvironment.create.mockResolvedValueOnce({
      oid: BigInt(50),
      id: 'een_test_id',
      systemIdentifier: `system:${tenant.id}`
    });
    mockDb.enclave.create.mockResolvedValueOnce({
      oid: BigInt(60),
      id: 'enc_test_id',
      identifier: 'my-provider-abcdefghij',
      name: 'My Provider',
      description: ''
    });

    let result = await enclaveInternalService.ensureEnclaveForProviderDeployment({
      tenant,
      solution,
      environment,
      provider,
      providerDeployment
    });

    expect(mockDb.enclaveEnvironment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: `System (${tenant.id})`,
        type: 'metorial',
        systemIdentifier: `system:${tenant.id}`,
        tenantOid: tenant.oid
      })
    });

    expect(mockDb.enclave.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        identifier: 'my-provider-abcdefghij',
        name: 'My Provider',
        description: '',
        providerDeploymentOid: providerDeployment.oid,
        tenantOid: tenant.oid,
        environmentOid: environment.oid,
        solutionOid: solution.oid,
        enclaveEnvironmentOid: BigInt(50)
      })
    });

    expect(result).toMatchObject({
      identifier: 'my-provider-abcdefghij',
      name: 'My Provider',
      description: ''
    });
  });

  it('reuses an existing system enclave environment for the tenant', async () => {
    mockDb.enclave.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    mockDb.enclaveEnvironment.findFirst.mockResolvedValueOnce({
      oid: BigInt(70),
      id: 'een_existing',
      systemIdentifier: `system:${tenant.id}`
    });
    mockDb.enclave.create.mockResolvedValueOnce({
      oid: BigInt(80),
      id: 'enc_new'
    });

    await enclaveInternalService.ensureEnclaveForProviderDeployment({
      tenant,
      solution,
      environment,
      provider,
      providerDeployment
    });

    expect(mockDb.enclaveEnvironment.create).not.toHaveBeenCalled();
    expect(mockDb.enclave.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        enclaveEnvironmentOid: BigInt(70)
      })
    });
  });
});
