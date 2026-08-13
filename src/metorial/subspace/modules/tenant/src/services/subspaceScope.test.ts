import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  tenantFind: vi.fn(),
  environmentFind: vi.fn(),
  projectUpdate: vi.fn(),
  instanceUpdate: vi.fn(),
  organizationUpdate: vi.fn(),
  resourceTenantFind: vi.fn(),
  resourceGroupFind: vi.fn(),
  tenantUpsert: vi.fn(),
  environmentUpsert: vi.fn(),
  solutionUpsert: vi.fn()
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_name, factory) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('@metorial/db', () => ({
  ID: { generateId: vi.fn() }
}));

vi.mock('@metorial-subspace/db', () => ({
  db: {
    tenant: { findUnique: mocks.tenantFind },
    environment: { findUnique: mocks.environmentFind }
  }
}));

vi.mock('../env', () => ({
  env: { service: { SUBSPACE_SOLUTION: 'metorial' } }
}));

vi.mock('../lib/metorialDb', () => ({
  metorialDb: {
    project: {
      findUniqueOrThrow: vi.fn(),
      findFirst: vi.fn(),
      update: mocks.projectUpdate
    },
    instance: {
      findUniqueOrThrow: vi.fn(),
      update: mocks.instanceUpdate
    },
    organization: { update: mocks.organizationUpdate },
    resourceTenant: {
      findUniqueOrThrow: mocks.resourceTenantFind,
      upsert: vi.fn()
    },
    resourceGroup: {
      findUniqueOrThrow: mocks.resourceGroupFind,
      upsert: vi.fn()
    }
  }
}));

vi.mock('./tenant', () => ({
  tenantService: { upsertTenant: mocks.tenantUpsert }
}));

vi.mock('./environment', () => ({
  environmentService: { upsertEnvironment: mocks.environmentUpsert }
}));

vi.mock('./solution', () => ({
  solutionService: { upsertSolution: mocks.solutionUpsert }
}));

vi.mock('./actor', () => ({
  actorService: {}
}));

import { subspaceScopeService } from './subspaceScope';

let resourceTenant = {
  oid: 100n,
  id: 'rtn_100',
  identifier: 'mte-pro-2',
  name: 'Project'
};
let resourceGroup = {
  oid: 200n,
  id: 'rgr_200',
  identifier: 'mte-ins-3',
  name: 'Production',
  type: 'production'
};
let canonicalTenant = {
  oid: 20n,
  id: 'ktn_canonical',
  identifier: 'mte-pro-2'
};
let canonicalEnvironment = {
  oid: 30n,
  id: 'ken_canonical',
  identifier: 'mte-ins-3',
  tenantOid: 20n
};

let makeProject = (overrides: Record<string, unknown> = {}) =>
  ({
    oid: 2n,
    id: 'prj_2',
    name: 'Project',
    onlyAllowTrustedProviders: false,
    organizationOid: 1n,
    resourceTenantOid: 100n,
    instances: [],
    ...overrides
  }) as any;

describe('Subspace canonical scope reconciliation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resourceTenantFind.mockResolvedValue(resourceTenant);
    mocks.resourceGroupFind.mockResolvedValue(resourceGroup);
    mocks.tenantUpsert.mockResolvedValue(canonicalTenant);
    mocks.environmentUpsert.mockResolvedValue(canonicalEnvironment);
    mocks.solutionUpsert.mockResolvedValue({
      oid: 1,
      id: 'kso_1',
      identifier: 'metorial'
    });
  });

  it('asserts and leaves an existing canonical project link untouched', async () => {
    let project = makeProject({
      internalTenantIdentifier: 'mte-pro-2',
      subspaceTenantId: 'ktn_canonical'
    });
    mocks.tenantFind.mockResolvedValue({ identifier: 'mte-pro-2' });

    await subspaceScopeService.ensureForProject(project);

    expect(mocks.projectUpdate).not.toHaveBeenCalled();
    expect(mocks.tenantUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({ identifier: 'mte-pro-2' })
      })
    );
  });

  it('fails before reconciliation when a canonical-looking project link is wrong', async () => {
    let project = makeProject({
      internalTenantIdentifier: 'mte-pro-999',
      subspaceTenantId: 'ktn_wrong'
    });

    await expect(subspaceScopeService.ensureForProject(project)).rejects.toThrow(
      'expected mte-pro-2'
    );
    expect(mocks.tenantUpsert).not.toHaveBeenCalled();
    expect(mocks.projectUpdate).not.toHaveBeenCalled();
  });

  it('replaces legacy project and instance links with new canonical scope links', async () => {
    let organization = {
      oid: 1n,
      id: 'org_1',
      subspaceTenantIds: ['ktn_legacy']
    };
    let project = makeProject({
      internalTenantIdentifier: 'mteo-org_legacy',
      subspaceTenantId: 'ktn_legacy'
    });
    let instance = {
      oid: 3n,
      id: 'ins_3',
      name: 'Production',
      type: 'production',
      organizationOid: 1n,
      projectOid: 2n,
      resourceGroupOid: 200n,
      internalTenantIdentifier: 'mteo-org_legacy',
      internalEnvironmentIdentifier: 'mtei-ins_legacy',
      subspaceTenantId: 'ktn_legacy',
      subspaceEnvironmentId: 'ken_legacy',
      project,
      organization
    } as any;
    project.instances = [instance];

    await subspaceScopeService.ensureForInstance(instance);

    expect(mocks.projectUpdate).toHaveBeenCalledWith({
      where: { id: 'prj_2' },
      data: {
        internalTenantIdentifier: 'mte-pro-2',
        subspaceTenantId: 'ktn_canonical'
      }
    });
    expect(mocks.instanceUpdate).toHaveBeenCalledWith({
      where: { id: 'ins_3' },
      data: expect.objectContaining({
        internalTenantIdentifier: 'mte-pro-2',
        subspaceTenantId: 'ktn_canonical',
        internalEnvironmentIdentifier: 'mte-ins-3',
        subspaceEnvironmentId: 'ken_canonical',
        lastSubspaceSyncAt: expect.any(Date)
      })
    });
    expect(mocks.environmentUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant: canonicalTenant,
        input: expect.objectContaining({ identifier: 'mte-ins-3' })
      })
    );
    expect(mocks.tenantFind).not.toHaveBeenCalled();
    expect(mocks.environmentFind).not.toHaveBeenCalled();
  });
});
