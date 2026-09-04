import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db, tx, createIntegrationVersionMock } = vi.hoisted(() => {
  let createModel = () => ({
    create: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn()
  });

  return {
    db: {
      integration: createModel()
    },
    tx: {
      integration: createModel()
    },
    createIntegrationVersionMock: vi.fn()
  };
});

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_name, factory) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('@metorial-subspace/db', () => ({
  addAfterTransactionHook: async (cb: () => Promise<void>) => await cb(),
  db,
  getId: (kind: string) => ({ id: `${kind}_new`, oid: 100n }),
  withTransaction: async (cb: (db: any) => Promise<any>) => await cb(tx)
}));

vi.mock('@metorial-subspace/list-utils', () => ({
  checkDeletedEdit: vi.fn(),
  normalizeDateFilter: vi.fn(),
  normalizeStatusForGet: vi.fn(() => ({ noParent: {} })),
  normalizeStatusForList: vi.fn(() => ({ noParent: {} })),
  resolveIntegrationProviders: vi.fn(),
  resolveProviders: vi.fn()
}));

vi.mock('@metorial-subspace/module-search', () => ({
  voyager: { record: { search: vi.fn() } },
  voyagerIndex: { integration: { id: 'idx_integration' } },
  voyagerSource: Promise.resolve({ id: 'src_1' })
}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  checkTenant: vi.fn(),
  getMetorialSolution: vi.fn(async () => ({ oid: 2 })),
  resolveMetorialFacing: vi.fn(),
  toProviderEventBase: vi.fn(() => ({}))
}));

vi.mock('@metorial/fabric', () => ({
  Fabric: { fire: vi.fn() }
}));

vi.mock('../lib/versions', () => ({
  createIntegrationVersion: createIntegrationVersionMock
}));

vi.mock('../queues/lifecycle/integration', () => ({
  integrationArchivedQueue: { add: vi.fn() },
  integrationCreatedQueue: { add: vi.fn() },
  integrationUpdatedQueue: { add: vi.fn() }
}));

vi.mock('./integrationVersion', () => ({
  integrationVersionInclude: {}
}));

import { integrationService } from './integration';

let linkedTenant = { oid: 1n, projectOid: 11n } as any;
let linkedEnvironment = { oid: 3n, instanceOid: 33n } as any;

let createdIntegration = { oid: 100n, id: 'integration_new' };

describe('integrationService.createIntegrationInternal', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    tx.integration.create.mockResolvedValue(createdIntegration);
    tx.integration.findUniqueOrThrow.mockResolvedValue(createdIntegration);
  });

  it('mirrors the tenant project and environment instance onto the new integration', async () => {
    await integrationService.createIntegrationInternal({
      tenant: linkedTenant,
      environment: linkedEnvironment,
      input: { name: 'Support Tools' }
    } as any);

    expect(tx.integration.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantOid: 1n,
          projectOid: 11n,
          solutionOid: 2,
          environmentOid: 3n,
          instanceOid: 33n
        })
      })
    );
  });

  it('writes null mirrors for a tenant and environment that are not linked yet', async () => {
    await integrationService.createIntegrationInternal({
      tenant: { oid: 1n, projectOid: null },
      environment: { oid: 3n, instanceOid: null },
      input: { name: 'Support Tools' }
    } as any);

    expect(tx.integration.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantOid: 1n,
          projectOid: null,
          environmentOid: 3n,
          instanceOid: null
        })
      })
    );
  });

  it('mirrors the same references through the magic MCP backing upsert', async () => {
    tx.integration.upsert.mockResolvedValue({
      ...createdIntegration,
      currentVersionOid: 200n
    });

    await integrationService.upsertMagicMcpIntegrationInternal({
      tenant: linkedTenant,
      environment: linkedEnvironment,
      input: { slug: 'support-tools', name: 'Support Tools' }
    } as any);

    expect(tx.integration.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          tenantOid: 1n,
          projectOid: 11n,
          environmentOid: 3n,
          instanceOid: 33n
        })
      })
    );
  });
});
