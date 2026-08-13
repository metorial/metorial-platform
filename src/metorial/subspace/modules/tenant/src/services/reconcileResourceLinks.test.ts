import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  metorialProjectFind: vi.fn(),
  tenantFind: vi.fn(),
  tenantUpdateMany: vi.fn(),
  environmentFind: vi.fn(),
  environmentUpdateMany: vi.fn()
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_name, factory) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('@metorial-subspace/db', () => ({
  db: {
    tenant: {
      findUnique: mocks.tenantFind,
      updateMany: mocks.tenantUpdateMany
    },
    environment: {
      findUnique: mocks.environmentFind,
      updateMany: mocks.environmentUpdateMany
    },
    tenantActor: {
      findUnique: vi.fn(),
      updateMany: vi.fn()
    }
  }
}));

vi.mock('../lib/metorialDb', () => ({
  metorialDb: {
    project: { findUnique: mocks.metorialProjectFind },
    organizationActor: { findUnique: vi.fn() },
    resourceTenant: { findUnique: vi.fn() }
  }
}));

import { reconcileResourceLinksService } from './reconcileResourceLinks';

let resourceTenant = { id: 'rtn_100', identifier: 'mte-pro-2' };
let resourceGroup = { id: 'rgr_200', identifier: 'mte-ins-3' };

let makeProject = (overrides: Record<string, unknown> = {}) => ({
  oid: 2n,
  subspaceTenantId: 'ktn_1',
  resourceTenant,
  instances: [
    {
      oid: 3n,
      subspaceEnvironmentId: 'ken_1',
      resourceGroup
    }
  ],
  ...overrides
});

describe('Resource link reconciliation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tenantUpdateMany.mockResolvedValue({ count: 1 });
    mocks.environmentUpdateMany.mockResolvedValue({ count: 1 });
  });

  it('backfills the project and instance references when they are missing', async () => {
    mocks.metorialProjectFind.mockResolvedValue(makeProject());
    mocks.tenantFind.mockResolvedValue({
      resourceTenantId: resourceTenant.id,
      resourceTenantIdentifier: resourceTenant.identifier,
      projectOid: null
    });
    mocks.environmentFind.mockResolvedValue({
      resourceGroupId: resourceGroup.id,
      resourceGroupIdentifier: resourceGroup.identifier,
      instanceOid: null
    });

    let result = await reconcileResourceLinksService.reconcileProjectLinks({
      projectOid: 2n
    });

    expect(mocks.tenantUpdateMany).toHaveBeenCalledWith({
      where: { id: 'ktn_1' },
      data: { projectOid: 2n }
    });
    expect(mocks.environmentUpdateMany).toHaveBeenCalledWith({
      where: { id: 'ken_1' },
      data: { instanceOid: 3n }
    });
    expect(result).toEqual({ linkedTenants: 1, linkedEnvironments: 1 });
  });

  it('writes nothing when every reference is already correct', async () => {
    mocks.metorialProjectFind.mockResolvedValue(makeProject());
    mocks.tenantFind.mockResolvedValue({
      resourceTenantId: resourceTenant.id,
      resourceTenantIdentifier: resourceTenant.identifier,
      projectOid: 2n
    });
    mocks.environmentFind.mockResolvedValue({
      resourceGroupId: resourceGroup.id,
      resourceGroupIdentifier: resourceGroup.identifier,
      instanceOid: 3n
    });

    let result = await reconcileResourceLinksService.reconcileProjectLinks({
      projectOid: 2n
    });

    expect(mocks.tenantUpdateMany).not.toHaveBeenCalled();
    expect(mocks.environmentUpdateMany).not.toHaveBeenCalled();
    expect(result).toEqual({ linkedTenants: 0, linkedEnvironments: 0 });
  });

  it('repoints a reference that drifted to the wrong oid', async () => {
    mocks.metorialProjectFind.mockResolvedValue(makeProject());
    mocks.tenantFind.mockResolvedValue({
      resourceTenantId: resourceTenant.id,
      resourceTenantIdentifier: resourceTenant.identifier,
      projectOid: 99n
    });
    mocks.environmentFind.mockResolvedValue({
      resourceGroupId: resourceGroup.id,
      resourceGroupIdentifier: resourceGroup.identifier,
      instanceOid: 98n
    });

    await reconcileResourceLinksService.reconcileProjectLinks({ projectOid: 2n });

    expect(mocks.tenantUpdateMany).toHaveBeenCalledWith({
      where: { id: 'ktn_1' },
      data: { projectOid: 2n }
    });
    expect(mocks.environmentUpdateMany).toHaveBeenCalledWith({
      where: { id: 'ken_1' },
      data: { instanceOid: 3n }
    });
  });

  it('still backfills references for projects that have no resource tenant yet', async () => {
    mocks.metorialProjectFind.mockResolvedValue(
      makeProject({
        resourceTenant: null,
        instances: [{ oid: 3n, subspaceEnvironmentId: 'ken_1', resourceGroup: null }]
      })
    );
    mocks.tenantFind.mockResolvedValue({
      resourceTenantId: null,
      resourceTenantIdentifier: null,
      projectOid: null
    });
    mocks.environmentFind.mockResolvedValue({
      resourceGroupId: null,
      resourceGroupIdentifier: null,
      instanceOid: null
    });

    await reconcileResourceLinksService.reconcileProjectLinks({ projectOid: 2n });

    expect(mocks.tenantUpdateMany).toHaveBeenCalledWith({
      where: { id: 'ktn_1' },
      data: { projectOid: 2n }
    });
    expect(mocks.environmentUpdateMany).toHaveBeenCalledWith({
      where: { id: 'ken_1' },
      data: { instanceOid: 3n }
    });
  });

  it('reconciles the resource links and the new references in a single write', async () => {
    mocks.metorialProjectFind.mockResolvedValue(makeProject());
    mocks.tenantFind.mockResolvedValue({
      resourceTenantId: 'rtn_stale',
      resourceTenantIdentifier: 'stale',
      projectOid: null
    });
    mocks.environmentFind.mockResolvedValue({
      resourceGroupId: 'rgr_stale',
      resourceGroupIdentifier: 'stale',
      instanceOid: null
    });

    await reconcileResourceLinksService.reconcileProjectLinks({ projectOid: 2n });

    expect(mocks.tenantUpdateMany).toHaveBeenCalledWith({
      where: { id: 'ktn_1' },
      data: {
        resourceTenantId: resourceTenant.id,
        resourceTenantIdentifier: resourceTenant.identifier,
        projectOid: 2n
      }
    });
    expect(mocks.environmentUpdateMany).toHaveBeenCalledWith({
      where: { id: 'ken_1' },
      data: {
        resourceGroupId: resourceGroup.id,
        resourceGroupIdentifier: resourceGroup.identifier,
        instanceOid: 3n
      }
    });
  });
});
