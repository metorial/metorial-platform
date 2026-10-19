import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => {
  let pairFindUnique = vi.fn();
  let pairUpsert = vi.fn();

  return {
    pairFindUnique,
    pairUpsert,
    waitForDiscovery: vi.fn(),
    dbPrimary: {
      providerDeploymentConfigPairProviderVersion: {
        findFirst: vi.fn(),
        findFirstOrThrow: vi.fn()
      }
    },
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

vi.mock('../lib/discoverySignal', () => ({
  waitForDiscovery: mocks.waitForDiscovery
}));

vi.mock('@metorial-subspace/db', () => ({
  db: mocks.db,
  dbPrimary: mocks.dbPrimary,
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

  it('waits for the discovery signal and re-reads the pair version once from the primary', async () => {
    let pair = { oid: 20n, id: 'pair_1', lastUsedPairVersionOid: null };
    let discovering = { oid: 30n, specificationDiscoveryStatus: 'discovering' };
    let discovered = { ...discovering, specificationDiscoveryStatus: 'discovered' };

    mocks.pairFindUnique.mockResolvedValue({ ...pair, versions: [discovering] });
    mocks.dbPrimary.providerDeploymentConfigPairProviderVersion.findFirstOrThrow.mockResolvedValue(
      discovered
    );

    let res = await providerDeploymentConfigPairInternalService.useDeploymentConfigPair({
      ...makeParts(),
      version: { oid: 40n }
    });

    expect(mocks.waitForDiscovery).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'pairVersion', oid: discovering.oid })
    );
    expect(
      mocks.dbPrimary.providerDeploymentConfigPairProviderVersion.findFirstOrThrow
    ).toHaveBeenCalledTimes(1);
    expect(
      mocks.db.providerDeploymentConfigPairProviderVersion.findFirstOrThrow
    ).not.toHaveBeenCalled();
    expect(res.version).toBe(discovered);
  });

  it('does not wait when discovery has already finished', async () => {
    let pairVersion = { oid: 30n, specificationDiscoveryStatus: 'discovered' };
    mocks.pairFindUnique.mockResolvedValue({
      oid: 20n,
      id: 'pair_1',
      lastUsedPairVersionOid: 30n,
      versions: [pairVersion]
    });

    await providerDeploymentConfigPairInternalService.useDeploymentConfigPair({
      ...makeParts(),
      version: { oid: 40n }
    });

    expect(mocks.waitForDiscovery).not.toHaveBeenCalled();
  });
});
