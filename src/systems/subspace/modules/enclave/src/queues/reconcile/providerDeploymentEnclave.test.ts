import { QueueRetryError } from '@lowerdeck/queue';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let { mockDb, ensureEnclaveForProviderDeployment } = vi.hoisted(() => ({
  mockDb: {
    providerDeployment: {
      findUnique: vi.fn(),
      update: vi.fn()
    }
  },
  ensureEnclaveForProviderDeployment: vi.fn()
}));

vi.mock('@lowerdeck/cron', () => ({
  createCron: () => ({})
}));

vi.mock('@lowerdeck/queue', async importOriginal => {
  let actual = await importOriginal<typeof import('@lowerdeck/queue')>();
  return {
    ...actual,
    createQueue: () => ({
      process: () => ({}),
      add: vi.fn(),
      addMany: vi.fn()
    }),
    combineQueueProcessors: (...processors: unknown[]) => processors
  };
});

vi.mock('@metorial-subspace/db', () => ({
  db: mockDb
}));

vi.mock('../../services/enclaveInternal', () => ({
  enclaveInternalService: {
    ensureEnclaveForProviderDeployment
  }
}));

vi.mock('../../env', () => ({
  env: {
    service: {
      REDIS_URL: 'redis://localhost:6379'
    }
  }
}));

import { reconcileProviderDeploymentEnclave } from './providerDeploymentEnclave';

let baseDeployment = {
  oid: BigInt(1),
  id: 'pde_test',
  status: 'active' as const,
  isEphemeral: false,
  isEnclaveReconciled: false,
  tenant: { oid: BigInt(10), id: 'ktn_test' },
  environment: { oid: BigInt(20), id: 'env_test' },
  solution: { oid: 1, id: 'sol_test' },
  provider: { oid: BigInt(30), id: 'prv_test', name: 'Test Provider' }
};

describe('reconcileProviderDeploymentEnclave', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.providerDeployment.update.mockResolvedValue(undefined);
    ensureEnclaveForProviderDeployment.mockResolvedValue({ id: 'enc_test' });
  });

  it('no-ops when deployment is missing', async () => {
    mockDb.providerDeployment.findUnique.mockResolvedValue(null);

    await reconcileProviderDeploymentEnclave('pde_missing');

    expect(ensureEnclaveForProviderDeployment).not.toHaveBeenCalled();
    expect(mockDb.providerDeployment.update).not.toHaveBeenCalled();
  });

  it('no-ops when deployment is already reconciled', async () => {
    mockDb.providerDeployment.findUnique.mockResolvedValue({
      ...baseDeployment,
      isEnclaveReconciled: true
    });

    await reconcileProviderDeploymentEnclave('pde_test');

    expect(ensureEnclaveForProviderDeployment).not.toHaveBeenCalled();
    expect(mockDb.providerDeployment.update).not.toHaveBeenCalled();
  });

  it('marks ephemeral deployments reconciled without creating an enclave', async () => {
    mockDb.providerDeployment.findUnique.mockResolvedValue({
      ...baseDeployment,
      isEphemeral: true
    });

    await reconcileProviderDeploymentEnclave('pde_test');

    expect(ensureEnclaveForProviderDeployment).not.toHaveBeenCalled();
    expect(mockDb.providerDeployment.update).toHaveBeenCalledWith({
      where: { oid: baseDeployment.oid },
      data: { isEnclaveReconciled: true }
    });
  });

  it('marks archived deployments reconciled without creating an enclave', async () => {
    mockDb.providerDeployment.findUnique.mockResolvedValue({
      ...baseDeployment,
      status: 'archived'
    });

    await reconcileProviderDeploymentEnclave('pde_test');

    expect(ensureEnclaveForProviderDeployment).not.toHaveBeenCalled();
    expect(mockDb.providerDeployment.update).toHaveBeenCalledWith({
      where: { oid: baseDeployment.oid },
      data: { isEnclaveReconciled: true }
    });
  });

  it('marks deleted deployments reconciled without creating an enclave', async () => {
    mockDb.providerDeployment.findUnique.mockResolvedValue({
      ...baseDeployment,
      status: 'deleted'
    });

    await reconcileProviderDeploymentEnclave('pde_test');

    expect(ensureEnclaveForProviderDeployment).not.toHaveBeenCalled();
    expect(mockDb.providerDeployment.update).toHaveBeenCalledWith({
      where: { oid: baseDeployment.oid },
      data: { isEnclaveReconciled: true }
    });
  });

  it('ensures enclave and marks active non-ephemeral deployments reconciled', async () => {
    mockDb.providerDeployment.findUnique.mockResolvedValue(baseDeployment);

    await reconcileProviderDeploymentEnclave('pde_test');

    expect(ensureEnclaveForProviderDeployment).toHaveBeenCalledWith({
      tenant: baseDeployment.tenant,
      solution: baseDeployment.solution,
      environment: baseDeployment.environment,
      provider: baseDeployment.provider,
      providerDeployment: baseDeployment
    });
    expect(mockDb.providerDeployment.update).toHaveBeenCalledWith({
      where: { oid: baseDeployment.oid },
      data: { isEnclaveReconciled: true }
    });
  });

  it('throws QueueRetryError when ensure fails', async () => {
    mockDb.providerDeployment.findUnique.mockResolvedValue(baseDeployment);
    ensureEnclaveForProviderDeployment.mockRejectedValue(new Error('db unavailable'));

    await expect(reconcileProviderDeploymentEnclave('pde_test')).rejects.toBeInstanceOf(
      QueueRetryError
    );
    expect(mockDb.providerDeployment.update).not.toHaveBeenCalled();
  });
});
