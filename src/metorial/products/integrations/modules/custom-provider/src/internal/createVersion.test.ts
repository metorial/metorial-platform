import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  db: {
    customProvider: { update: vi.fn(), updateMany: vi.fn() },
    customProviderDeployment: { create: vi.fn(), updateMany: vi.fn() },
    customProviderVersion: { create: vi.fn(), updateMany: vi.fn() },
    customProviderEnvironment: { upsert: vi.fn() },
    customProviderCommit: { create: vi.fn() },
    customProviderEnvironmentVersion: { create: vi.fn() }
  },
  deploymentCreatedQueueAdd: vi.fn()
}));

vi.mock('@metorial-subspace/db', () => ({
  db: mocks.db,
  getId: (name: string) => ({ oid: 1n, id: `${name}_test` }),
  withTransaction: (fn: any) => fn(mocks.db),
  addAfterTransactionHook: (fn: any) => fn()
}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  actorService: { getSystemActor: vi.fn() }
}));

vi.mock('../queues/lifecycle/customProviderDeployment', () => ({
  customProviderDeploymentCreatedQueue: { add: mocks.deploymentCreatedQueueAdd }
}));

import { createVersion, prepareVersion } from './createVersion';

let linkedTenant = { oid: 20n, projectOid: 21n };
let linkedEnvironment = { oid: 30n, instanceOid: 31n };
let solution = { oid: 1 };
let actor = { oid: 40n };
let customProvider = { oid: 10n, scmRepoOid: null };

let makePrepareInput = (overrides: Record<string, unknown> = {}) =>
  ({
    actor,
    tenant: linkedTenant,
    solution,
    environment: linkedEnvironment,
    trigger: 'manual',
    customProvider,
    payload: { from: { type: 'remote' } },
    ...overrides
  }) as any;

let makeCreateInput = (overrides: Record<string, unknown> = {}) =>
  ({
    actor,
    tenant: linkedTenant,
    solution,
    environment: linkedEnvironment,
    message: 'A commit',
    customProvider,
    deployment: { oid: 50n, id: 'kcpd_1', trigger: 'manual', scmRepoPushOid: null },
    version: { oid: 60n },
    shuttleServer: { oid: 70n },
    shuttleCustomServer: { oid: 71n },
    shuttleCustomDeployment: { oid: 72n },
    ...overrides
  }) as any;

describe('prepareVersion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.db.customProviderDeployment.create.mockResolvedValue({ oid: 50n });
    mocks.db.customProvider.update.mockResolvedValue({ maxVersionIndex: 3 });
    mocks.db.customProviderVersion.create.mockResolvedValue({ oid: 60n });
  });

  it('mirrors the tenant project onto the deployment and the version', async () => {
    await prepareVersion(makePrepareInput());

    expect(mocks.db.customProviderDeployment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tenantOid: 20n, projectOid: 21n })
    });
    expect(mocks.db.customProviderVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tenantOid: 20n, projectOid: 21n })
    });
  });

  it('writes null for a tenant that is not linked to a project yet', async () => {
    await prepareVersion(makePrepareInput({ tenant: { oid: 20n, projectOid: null } }));

    expect(mocks.db.customProviderDeployment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tenantOid: 20n, projectOid: null })
    });
    expect(mocks.db.customProviderVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tenantOid: 20n, projectOid: null })
    });
  });
});

describe('createVersion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.db.customProvider.updateMany.mockResolvedValue({ count: 1 });
    mocks.db.customProviderDeployment.updateMany.mockResolvedValue({ count: 1 });
    mocks.db.customProviderVersion.updateMany.mockResolvedValue({ count: 1 });
    mocks.db.customProviderEnvironment.upsert.mockResolvedValue({
      oid: 80n,
      providerEnvironment: null
    });
    mocks.db.customProviderCommit.create.mockResolvedValue({ oid: 90n });
    mocks.db.customProviderEnvironmentVersion.create.mockResolvedValue({ oid: 100n });
  });

  it('mirrors the project and the instance onto the upserted custom provider environment', async () => {
    await createVersion(makeCreateInput());

    expect(mocks.db.customProviderEnvironment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          tenantOid: 20n,
          projectOid: 21n,
          environmentOid: 30n,
          instanceOid: 31n
        })
      })
    );
  });

  it('keeps the environment upsert keyed on the legacy environment column', async () => {
    await createVersion(makeCreateInput());

    let [call] = mocks.db.customProviderEnvironment.upsert.mock.calls;
    expect(call![0].where).toEqual({
      environmentOid_customProviderOid: {
        environmentOid: 30n,
        customProviderOid: 10n
      }
    });
  });

  it('mirrors the project onto the commit and the instance onto the environment version', async () => {
    await createVersion(makeCreateInput());

    expect(mocks.db.customProviderCommit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tenantOid: 20n, projectOid: 21n })
    });
    expect(mocks.db.customProviderEnvironmentVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ environmentOid: 30n, instanceOid: 31n })
    });
  });

  it('writes null for an environment that is not linked to an instance yet', async () => {
    await createVersion(
      makeCreateInput({
        tenant: { oid: 20n, projectOid: null },
        environment: { oid: 30n, instanceOid: null }
      })
    );

    expect(mocks.db.customProviderEnvironment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          tenantOid: 20n,
          projectOid: null,
          environmentOid: 30n,
          instanceOid: null
        })
      })
    );
    expect(mocks.db.customProviderEnvironmentVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ environmentOid: 30n, instanceOid: null })
    });
  });
});
