import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => {
  let pairFindUnique = vi.fn();
  let pairUpsert = vi.fn();

  return {
    pairFindUnique,
    pairUpsert,
    db: {
      providerDeploymentConfigPair: {
        findUnique: pairFindUnique,
        upsert: pairUpsert,
        updateMany: vi.fn()
      },
      providerDeploymentConfigPairProviderVersion: {
        findFirst: vi.fn(),
        findFirstOrThrow: vi.fn(),
        upsert: vi.fn()
      }
    }
  };
});

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_name, factory) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('@lowerdeck/delay', () => ({
  delay: vi.fn()
}));

vi.mock('@metorial-subspace/db', () => ({
  db: mocks.db,
  getId: (model: string) => ({ oid: 100n, id: `${model}_id` }),
  withTransaction: async (fn: (tx: typeof mocks.db) => Promise<unknown>) => await fn(mocks.db),
  addAfterTransactionHook: async (fn: () => Promise<unknown>) => await fn()
}));

vi.mock('../queues/lifecycle/deploymentConfigPair', () => ({
  providerDeploymentConfigPairCreatedQueue: { add: vi.fn() },
  providerDeploymentConfigPairVersionCreatedQueue: { add: vi.fn() }
}));

import { providerDeploymentConfigPairInternalService } from './providerDeploymentConfigPair';

let makeParts = (deploymentOverrides: Record<string, unknown> = {}) =>
  ({
    deployment: {
      oid: 1n,
      tenantOid: 3n,
      projectOid: 7n,
      environmentOid: 4n,
      instanceOid: 8n,
      currentVersion: { oid: 11n },
      ...deploymentOverrides
    },
    config: {
      oid: 2n,
      currentVersion: { oid: 12n }
    },
    authConfig: null
  }) as any;

describe('providerDeploymentConfigPairInternalService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.pairFindUnique.mockResolvedValue(null);
    mocks.pairUpsert.mockImplementation(async ({ create }: any) => ({ ...create }));
  });

  it('copies the project and instance references from the deployment', async () => {
    await providerDeploymentConfigPairInternalService.upsertDeploymentConfigPair(makeParts());

    expect(mocks.pairUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          tenantOid: 3n,
          projectOid: 7n,
          environmentOid: 4n,
          instanceOid: 8n
        })
      })
    );
  });

  it('writes null references for a deployment that is not linked to a project or instance', async () => {
    await providerDeploymentConfigPairInternalService.upsertDeploymentConfigPair(
      makeParts({ projectOid: null, instanceOid: null })
    );

    let { create } = mocks.pairUpsert.mock.calls[0]![0];
    expect(create.tenantOid).toBe(3n);
    expect(create.projectOid).toBeNull();
    expect(create.environmentOid).toBe(4n);
    expect(create.instanceOid).toBeNull();
  });
});
