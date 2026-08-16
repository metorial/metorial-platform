import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  tenantFind: vi.fn(),
  environmentFind: vi.fn(),
  projectUpdate: vi.fn(),
  instanceUpdate: vi.fn(),
  organizationFind: vi.fn(),
  organizationUpdate: vi.fn(),
  organizationActorFind: vi.fn(),
  organizationActorUpdate: vi.fn(),
  resourceTenantFind: vi.fn(),
  resourceGroupFind: vi.fn(),
  resourceActorFind: vi.fn(),
  resourceActorCreate: vi.fn(),
  projectFindFirst: vi.fn(),
  tenantUpsert: vi.fn(),
  environmentUpsert: vi.fn(),
  solutionUpsert: vi.fn(),
  findActorForOrganizationActor: vi.fn(),
  upsertActor: vi.fn(),
  generateId: vi.fn()
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_name, factory) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('@metorial/db', () => ({
  ID: { generateId: mocks.generateId }
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
      findFirst: mocks.projectFindFirst,
      update: mocks.projectUpdate
    },
    instance: {
      findUniqueOrThrow: vi.fn(),
      update: mocks.instanceUpdate
    },
    organization: {
      findUniqueOrThrow: mocks.organizationFind,
      update: mocks.organizationUpdate
    },
    organizationActor: {
      findUniqueOrThrow: mocks.organizationActorFind,
      update: mocks.organizationActorUpdate
    },
    resourceTenant: {
      findUniqueOrThrow: mocks.resourceTenantFind,
      upsert: vi.fn()
    },
    resourceGroup: {
      findUniqueOrThrow: mocks.resourceGroupFind,
      upsert: vi.fn()
    },
    resourceActor: {
      findFirst: mocks.resourceActorFind,
      create: mocks.resourceActorCreate
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
  actorService: {
    findActorForOrganizationActor: mocks.findActorForOrganizationActor,
    upsertActor: mocks.upsertActor
  }
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

describe('Subspace scope provisioning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resourceTenantFind.mockResolvedValue(resourceTenant);
    mocks.resourceGroupFind.mockResolvedValue(resourceGroup);
    mocks.tenantUpsert.mockResolvedValue(canonicalTenant);
    mocks.environmentUpsert.mockResolvedValue(canonicalEnvironment);
    mocks.organizationFind.mockResolvedValue({
      id: 'org_1',
      subspaceTenantIds: ['ktn_canonical']
    });
    mocks.solutionUpsert.mockResolvedValue({
      oid: 1,
      id: 'kso_1',
      identifier: 'metorial'
    });
  });

  it('asserts and leaves an existing project link untouched', async () => {
    let project = makeProject({
      internalTenantIdentifier: 'mte-pro-2',
      subspaceTenantId: 'ktn_canonical'
    });
    mocks.tenantFind.mockResolvedValue({ identifier: 'mte-pro-2' });

    await subspaceScopeService.ensureForProject(project);

    expect(mocks.projectUpdate).not.toHaveBeenCalled();
    expect(mocks.tenantUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({ identifier: 'mte-pro-2', skipNetworks: true })
      })
    );
  });

  it('stores the project reference on the tenant and the instance reference on its environments', async () => {
    let instance = {
      oid: 3n,
      id: 'ins_3',
      name: 'Production',
      type: 'production',
      organizationOid: 1n,
      projectOid: 2n,
      resourceGroupOid: 200n,
      internalTenantIdentifier: 'mte-pro-2',
      internalEnvironmentIdentifier: 'mte-ins-3',
      subspaceTenantId: 'ktn_canonical',
      subspaceEnvironmentId: 'ken_canonical'
    } as any;
    let project = makeProject({
      internalTenantIdentifier: 'mte-pro-2',
      subspaceTenantId: 'ktn_canonical',
      instances: [instance]
    });
    instance.project = project;
    instance.organization = { oid: 1n, id: 'org_1', subspaceTenantIds: ['ktn_canonical'] };
    mocks.tenantFind.mockResolvedValue({ oid: 20n, identifier: 'mte-pro-2' });
    mocks.environmentFind.mockResolvedValue({
      identifier: 'mte-ins-3',
      tenantOid: 20n
    });

    await subspaceScopeService.ensureForInstance(instance);

    expect(mocks.tenantUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          projectOid: 2n,
          skipNetworks: true,
          environments: [expect.objectContaining({ instanceOid: 3n })]
        })
      })
    );
    expect(mocks.environmentUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({ instanceOid: 3n })
      })
    );
  });

  it('refuses to provision when the project carries an identifier its oid does not produce', async () => {
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

  it('refuses to provision a project whose tenant link resolves elsewhere', async () => {
    let project = makeProject({
      internalTenantIdentifier: 'mte-pro-2',
      subspaceTenantId: 'ktn_other'
    });
    mocks.tenantFind.mockResolvedValue({ identifier: 'mte-pro-77' });

    await expect(subspaceScopeService.ensureForProject(project)).rejects.toThrow(
      'linked to subspace tenant mte-pro-77, not mte-pro-2'
    );
    expect(mocks.tenantUpsert).not.toHaveBeenCalled();
    expect(mocks.projectUpdate).not.toHaveBeenCalled();
  });

  it('provisions a project whose tenant link points at a tenant that is gone', async () => {
    let project = makeProject({
      internalTenantIdentifier: 'mte-pro-2',
      subspaceTenantId: 'ktn_removed'
    });
    mocks.tenantFind.mockResolvedValue(null);

    await subspaceScopeService.ensureForProject(project);

    expect(mocks.tenantUpsert).toHaveBeenCalled();
  });

  it('refuses to provision an instance whose environment link resolves elsewhere', async () => {
    let project = makeProject({
      internalTenantIdentifier: 'mte-pro-2',
      subspaceTenantId: 'ktn_canonical'
    });
    let instance = {
      oid: 3n,
      id: 'ins_3',
      name: 'Production',
      type: 'production',
      organizationOid: 1n,
      projectOid: 2n,
      resourceGroupOid: 200n,
      internalTenantIdentifier: 'mte-pro-2',
      internalEnvironmentIdentifier: 'mte-ins-3',
      subspaceTenantId: 'ktn_canonical',
      subspaceEnvironmentId: 'ken_other',
      project,
      organization: { oid: 1n, id: 'org_1', subspaceTenantIds: ['ktn_canonical'] }
    } as any;
    project.instances = [instance];
    mocks.tenantFind.mockResolvedValue({ oid: 20n, identifier: 'mte-pro-2' });
    mocks.environmentFind.mockResolvedValue({ identifier: 'mte-ins-88', tenantOid: 20n });

    await expect(subspaceScopeService.ensureForInstance(instance)).rejects.toThrow(
      'linked to subspace environment mte-ins-88, not mte-ins-3'
    );
    expect(mocks.environmentUpsert).not.toHaveBeenCalled();
    expect(mocks.instanceUpdate).not.toHaveBeenCalled();
  });

  it('refuses to provision an instance whose environment sits under another tenant', async () => {
    let project = makeProject({
      internalTenantIdentifier: 'mte-pro-2',
      subspaceTenantId: 'ktn_canonical'
    });
    let instance = {
      oid: 3n,
      id: 'ins_3',
      name: 'Production',
      type: 'production',
      organizationOid: 1n,
      projectOid: 2n,
      resourceGroupOid: 200n,
      internalTenantIdentifier: 'mte-pro-2',
      internalEnvironmentIdentifier: 'mte-ins-3',
      subspaceTenantId: 'ktn_canonical',
      subspaceEnvironmentId: 'ken_canonical',
      project,
      organization: { oid: 1n, id: 'org_1', subspaceTenantIds: ['ktn_canonical'] }
    } as any;
    project.instances = [instance];
    mocks.tenantFind.mockResolvedValue({ oid: 20n, identifier: 'mte-pro-2' });
    mocks.environmentFind.mockResolvedValue({ identifier: 'mte-ins-3', tenantOid: 999n });

    await expect(subspaceScopeService.ensureForInstance(instance)).rejects.toThrow(
      'does not sit beneath tenant mte-pro-2'
    );
    expect(mocks.environmentUpsert).not.toHaveBeenCalled();
  });

  it('provisions a project that has never been linked to a tenant', async () => {
    let project = makeProject({
      internalTenantIdentifier: null,
      subspaceTenantId: null
    });

    await subspaceScopeService.ensureForProject(project);

    expect(mocks.tenantUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({ identifier: 'mte-pro-2' })
      })
    );
    expect(mocks.projectUpdate).toHaveBeenCalledWith({
      where: { id: 'prj_2' },
      data: {
        internalTenantIdentifier: 'mte-pro-2',
        subspaceTenantId: 'ktn_canonical'
      }
    });
  });

  it('tracks the tenant on its organization when the organization does not list it yet', async () => {
    mocks.organizationFind.mockResolvedValue({ id: 'org_1', subspaceTenantIds: [] });

    await subspaceScopeService.ensureForProject(
      makeProject({
        internalTenantIdentifier: 'mte-pro-2',
        subspaceTenantId: 'ktn_canonical'
      })
    );

    expect(mocks.organizationUpdate).toHaveBeenCalledWith({
      where: { id: 'org_1' },
      data: { subspaceTenantIds: { push: 'ktn_canonical' } }
    });
  });
});

describe('Organization actor tenant linking', () => {
  let tenant = {
    oid: 20n,
    id: 'ktn_20',
    identifier: 'mte-pro-2'
  };
  let organizationActor = {
    oid: 4n,
    id: 'oac_4',
    name: 'User',
    type: 'member',
    internalActorIdentifier: 'mte-oac-oac_4',
    subspaceActorId: 'act_other_tenant'
  };
  let resourceActor = {
    oid: 300n,
    id: 'rac_300',
    identifier: 'mte-oac-oac_4'
  };
  let tenantActor = {
    oid: 40n,
    id: 'act_40',
    identifier: 'mte-oac-oac_4',
    organizationActorOid: 4n
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.projectFindFirst.mockResolvedValue({ oid: 2n });
    mocks.resourceActorFind.mockResolvedValue(resourceActor);
    mocks.findActorForOrganizationActor.mockResolvedValue(null);
    mocks.upsertActor.mockResolvedValue(tenantActor);
  });

  it('creates a tenant actor for this tenant even when Metorial already stores another tenant actor id', async () => {
    await subspaceScopeService.ensureForOrganizationActor({
      tenant: tenant as any,
      organizationActor: organizationActor as any
    });

    expect(mocks.findActorForOrganizationActor).toHaveBeenCalledWith({
      tenant,
      organizationActor,
      identifier: 'mte-oac-oac_4'
    });
    expect(mocks.resourceActorFind).toHaveBeenCalledWith({
      where: {
        organizationActorOid: 4n,
        projectOid: 2n
      }
    });
    expect(mocks.upsertActor).toHaveBeenCalledWith({
      tenant,
      input: expect.objectContaining({
        identifier: 'mte-oac-oac_4',
        name: 'User',
        type: 'external',
        organizationActorId: 'oac_4',
        organizationActorOid: 4n,
        resourceActorId: 'rac_300',
        resourceActorIdentifier: 'mte-oac-oac_4'
      })
    });
    expect(mocks.organizationActorUpdate).not.toHaveBeenCalled();
  });

  it('reuses an existing tenant actor in this tenant and backfills the organization actor relation', async () => {
    mocks.findActorForOrganizationActor.mockResolvedValue({
      id: 'act_existing',
      organizationActorOid: null
    });
    mocks.upsertActor.mockResolvedValue({
      ...tenantActor,
      id: 'act_existing'
    });

    await subspaceScopeService.ensureForOrganizationActor({
      tenant: tenant as any,
      organizationActor: {
        ...organizationActor,
        subspaceActorId: null,
        internalActorIdentifier: null
      } as any
    });

    expect(mocks.upsertActor).toHaveBeenCalledWith({
      tenant,
      input: expect.objectContaining({
        id: 'act_existing',
        organizationActorOid: 4n
      })
    });
    expect(mocks.organizationActorUpdate).toHaveBeenCalledWith({
      where: { id: 'oac_4' },
      data: {
        internalActorIdentifier: 'mte-oac-oac_4',
        subspaceActorId: 'act_existing'
      }
    });
  });
});
