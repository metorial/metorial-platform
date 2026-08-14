import { beforeEach, describe, expect, it, vi } from 'vitest';

let environmentFindUnique = vi.fn();
let environmentUpsert = vi.fn();
let environmentFindFirst = vi.fn();
let reconcileAdd = vi.fn();
let linkEnvironmentToInstanceMirror = vi.fn();

vi.mock('@metorial-subspace/db', () => ({
  db: {
    environment: {
      findUnique: environmentFindUnique,
      upsert: environmentUpsert,
      findFirst: environmentFindFirst,
      findFirstOrThrow: vi.fn()
    }
  },
  getId: (model: string) => ({ oid: BigInt(1), id: `${model}_1` })
}));

vi.mock('../lib/mirrorRecords', () => ({
  linkEnvironmentToInstanceMirror: (...args: unknown[]) =>
    linkEnvironmentToInstanceMirror(...args)
}));

vi.mock(
  '@metorial-subspace/module-deployment/src/queues/reconcile/providerDeploymentMonitor',
  () => ({
    reconcileProviderDeploymentMonitorForEnvironmentQueue: {
      add: reconcileAdd
    }
  })
);

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: (_name: string, factory: () => unknown) => ({
      build: factory
    })
  }
}));

describe('environmentService.upsertEnvironment', () => {
  beforeEach(() => {
    vi.resetModules();
    environmentFindUnique.mockReset();
    environmentUpsert.mockReset();
    environmentFindFirst.mockReset();
    reconcileAdd.mockReset();
    linkEnvironmentToInstanceMirror.mockReset();
  });

  it('starts provider deployment monitor reconciliation for newly created environments', async () => {
    let tenant = { oid: BigInt(2) } as any;
    let environment = {
      id: 'env_1',
      oid: BigInt(3),
      identifier: 'production',
      name: 'Production',
      type: 'production'
    };

    environmentFindUnique.mockResolvedValue(null);
    environmentUpsert.mockResolvedValue(environment);

    let { environmentService } = await import('./environment');

    await environmentService.upsertEnvironment({
      tenant,
      input: {
        name: 'Production',
        identifier: 'production',
        type: 'production',
        resourceGroupId: 'resourceGroup_1',
        resourceGroupIdentifier: 'production'
      }
    });

    expect(reconcileAdd).toHaveBeenCalledWith(
      { environmentId: environment.id },
      { id: `provider-deployment-monitor-env:${environment.id}` }
    );
  });

  it('does not enqueue reconciliation when updating an existing environment', async () => {
    let tenant = { oid: BigInt(2) } as any;
    let environment = {
      id: 'env_1',
      oid: BigInt(3),
      identifier: 'production',
      name: 'Production',
      type: 'production'
    };

    environmentFindUnique.mockResolvedValue({ id: environment.id });
    environmentUpsert.mockResolvedValue(environment);

    let { environmentService } = await import('./environment');

    await environmentService.upsertEnvironment({
      tenant,
      input: {
        name: 'Production',
        identifier: 'production',
        type: 'production',
        resourceGroupId: 'resourceGroup_1',
        resourceGroupIdentifier: 'production'
      }
    });

    expect(reconcileAdd).not.toHaveBeenCalled();
  });

  it('mirrors the instance before returning the environment that references it', async () => {
    let tenant = { oid: BigInt(2) } as any;
    let environment = {
      id: 'env_1',
      oid: BigInt(3),
      tenantOid: BigInt(2),
      identifier: 'production',
      name: 'Production',
      type: 'production',
      instanceOid: null
    };

    environmentFindUnique.mockResolvedValue({ id: environment.id });
    environmentUpsert.mockResolvedValue(environment);
    linkEnvironmentToInstanceMirror.mockResolvedValue(BigInt(9));

    let { environmentService } = await import('./environment');

    let result = await environmentService.upsertEnvironment({
      tenant,
      input: {
        name: 'Production',
        identifier: 'production',
        type: 'production',
        resourceGroupId: 'resourceGroup_1',
        resourceGroupIdentifier: 'production',
        instanceOid: BigInt(9)
      }
    });

    expect(environmentUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.not.objectContaining({ instanceOid: expect.anything() }),
        create: expect.not.objectContaining({ instanceOid: expect.anything() })
      })
    );
    expect(linkEnvironmentToInstanceMirror).toHaveBeenCalledWith({
      environment,
      instanceOid: BigInt(9)
    });
    expect(result.instanceOid).toBe(BigInt(9));
  });
});
