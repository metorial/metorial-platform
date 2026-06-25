import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../env', () => ({
  env: {
    service: {
      REDIS_URL: 'redis://localhost:6379'
    }
  }
}));

let mockDb = vi.hoisted(() => ({
  enclave: {
    findFirst: vi.fn(),
    updateMany: vi.fn()
  },
  providerDeployment: {
    updateMany: vi.fn()
  }
}));

let syncEnclaveInstanceConfiguration = vi.hoisted(() => vi.fn());

vi.mock('@metorial-subspace/db', () => ({
  getId: () => ({ oid: 100n, id: 'sicf_test' }),
  db: mockDb
}));

vi.mock('@metorial-subspace/provider', () => ({
  getBackend: vi.fn(async () => ({
    backend: { type: 'slates' },
    enclaveInstanceConfiguration: {
      syncEnclaveInstanceConfiguration
    }
  }))
}));

vi.mock('../../services/enclave', () => ({
  enclaveService: {
    getCompiledNetworkRules: vi.fn(async () => ({
      ingress: { direction: 'ingress', entries: [] },
      egress: { direction: 'egress', entries: [{ cidr: '0.0.0.0/0' }] }
    }))
  }
}));

import { reconcileEnclaveInstanceConfiguration } from './enclaveInstanceConfiguration';

describe('reconcileEnclaveInstanceConfiguration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    syncEnclaveInstanceConfiguration.mockResolvedValue(undefined);
    mockDb.enclave.updateMany.mockResolvedValue({ count: 1 });
  });

  it('pushes compiled egress policy to slates and clears reconciliation flag', async () => {
    mockDb.enclave.findFirst.mockResolvedValue({
      oid: 10n,
      id: 'enc_test',
      needsEnclaveReconciliation: true,
      tenantOid: 2n,
      environmentOid: 3n,
      tenant: { oid: 2n, id: 'ktn_1', identifier: 'tenant', name: 'Tenant' },
      environment: { oid: 3n, id: 'ken_1' },
      providerDeployment: {
        oid: 40n,
        id: 'pde_1',
        status: 'active',
        isEphemeral: false,
        slateInstanceConfigurationOid: null,
        serverInstanceConfigurationOid: null,
        provider: { typeOid: 1 },
        providerVariant: { backendOid: 50n }
      }
    });

    await reconcileEnclaveInstanceConfiguration('enc_test');

    expect(syncEnclaveInstanceConfiguration).toHaveBeenCalledWith({
      tenant: { oid: 2n, id: 'ktn_1', identifier: 'tenant', name: 'Tenant' },
      providerDeployment: {
        oid: 40n,
        id: 'pde_1',
        status: 'active',
        isEphemeral: false,
        slateInstanceConfigurationOid: null,
        serverInstanceConfigurationOid: null,
        provider: { typeOid: 1 },
        providerVariant: { backendOid: 50n }
      },
      enclaveId: 'enc_test',
      egressPolicy: { direction: 'egress', entries: [{ cidr: '0.0.0.0/0' }] }
    });

    expect(mockDb.enclave.updateMany).toHaveBeenLastCalledWith({
      where: { oid: 10n },
      data: { needsEnclaveReconciliation: false }
    });
  });
});
