import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  resolveResourceScopeForOwner: vi.fn(),
  ensureOrganizationActor: vi.fn(),
  upsertResourceGroup: vi.fn(),
  findProject: vi.fn(),
  updateProject: vi.fn()
}));

vi.mock('@metorial/db', () => ({
  db: {
    project: {
      findUnique: mocks.findProject,
      update: mocks.updateProject
    }
  }
}));

vi.mock('@metorial/module-resource-tenant', () => ({
  resolveResourceScopeForOwner: mocks.resolveResourceScopeForOwner,
  resourceActorService: {
    ensureOrganizationActor: mocks.ensureOrganizationActor
  },
  resourceGroupService: {
    upsertResourceGroup: mocks.upsertResourceGroup
  }
}));

import {
  ensureOrganizationActorAuditScope,
  ensureOrganizationAuditScope,
  ensureOrganizationMemberAuditScope,
  ensureProjectActorAuditScope,
  ensureProjectAuditScope
} from './ensure';

let context = { ip: '127.0.0.1' };
let organization = { id: 'org_1' };
let organizationScope = {
  resourceTenant: { oid: 1n },
  resourceGroup: { oid: 2n, resourceTenantOid: 1n }
};

describe('ensure audit scopes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveResourceScopeForOwner.mockResolvedValue(organizationScope);
  });

  it('reuses the organization scope without ensuring a resource actor', async () => {
    await expect(
      ensureOrganizationAuditScope({
        organization,
        actor: { type: 'system', id: 'worker' },
        context
      })
    ).resolves.toEqual({
      resourceTenantOid: 1n,
      resourceGroupOid: 2n,
      resourceActorOid: undefined,
      actor: { type: 'system', id: 'worker' },
      context
    });

    expect(mocks.resolveResourceScopeForOwner).toHaveBeenCalledWith({
      type: 'organization',
      organization
    });
    expect(mocks.ensureOrganizationActor).not.toHaveBeenCalled();
  });

  it('reuses an included organization resource actor', async () => {
    let organizationActor = {
      oid: 11n,
      id: 'oac_1',
      resourceActors: [
        { oid: 12n, resourceTenantOid: 1n },
        { oid: 13n, resourceTenantOid: 99n }
      ]
    };

    await expect(
      ensureOrganizationActorAuditScope({
        organization,
        organizationActor,
        context
      })
    ).resolves.toMatchObject({
      resourceActorOid: 12n,
      actor: { type: 'org_actor', id: 'oac_1' }
    });
    expect(mocks.ensureOrganizationActor).not.toHaveBeenCalled();
  });

  it('ensures a missing organization resource actor', async () => {
    mocks.ensureOrganizationActor.mockResolvedValue({ oid: 14n });

    await expect(
      ensureOrganizationActorAuditScope({
        organization,
        organizationActor: { oid: 11n, id: 'oac_1' },
        context
      })
    ).resolves.toMatchObject({
      resourceActorOid: 14n,
      actor: { type: 'org_actor', id: 'oac_1' }
    });
    expect(mocks.ensureOrganizationActor).toHaveBeenCalledWith({
      resourceTenant: organizationScope.resourceTenant,
      organizationActorOid: 11n
    });
  });

  it('delegates organization member scopes to the member actor', async () => {
    mocks.ensureOrganizationActor.mockResolvedValue({ oid: 14n });

    await expect(
      ensureOrganizationMemberAuditScope({
        organization,
        member: {
          actor: { oid: 11n, id: 'oac_1' }
        },
        context
      })
    ).resolves.toMatchObject({
      resourceActorOid: 14n,
      actor: { type: 'org_actor', id: 'oac_1' }
    });
  });

  it('reuses a project group belonging to the organization tenant', async () => {
    mocks.findProject.mockResolvedValue({
      oid: 21n,
      id: 'pro_1',
      name: 'Project',
      organization: organization,
      resourceGroup: { oid: 22n, resourceTenantOid: 1n }
    });

    await expect(
      ensureProjectAuditScope({
        organization,
        project: { id: 'pro_1' },
        actor: { type: 'system', id: 'worker' },
        context
      })
    ).resolves.toMatchObject({
      resourceTenantOid: 1n,
      resourceGroupOid: 22n,
      resourceActorOid: undefined
    });
    expect(mocks.upsertResourceGroup).not.toHaveBeenCalled();
    expect(mocks.updateProject).not.toHaveBeenCalled();
  });

  it.each([
    ['a missing group', null],
    ['a group from another tenant', { oid: 29n, resourceTenantOid: 99n }]
  ])('creates and links a project group for %s', async (_, resourceGroup) => {
    mocks.findProject.mockResolvedValue({
      oid: 21n,
      id: 'pro_1',
      name: 'Project',
      organization,
      resourceGroup
    });
    mocks.upsertResourceGroup.mockResolvedValue({
      oid: 22n,
      resourceTenantOid: 1n
    });

    await expect(
      ensureProjectAuditScope({
        organization,
        project: { id: 'pro_1' },
        actor: { type: 'system', id: 'worker' },
        context
      })
    ).resolves.toMatchObject({
      resourceTenantOid: 1n,
      resourceGroupOid: 22n
    });
    expect(mocks.upsertResourceGroup).toHaveBeenCalledWith({
      resourceTenant: organizationScope.resourceTenant,
      input: {
        identifier: 'mte-pro-21',
        name: 'Project',
        type: 'production'
      }
    });
    expect(mocks.updateProject).toHaveBeenCalledWith({
      where: { oid: 21n },
      data: { resourceGroupOid: 22n }
    });
  });

  it('rejects a project from another organization', async () => {
    mocks.findProject.mockResolvedValue({
      oid: 21n,
      id: 'pro_1',
      name: 'Project',
      organization: { id: 'org_2' },
      resourceGroup: null
    });

    await expect(
      ensureProjectAuditScope({
        organization,
        project: { id: 'pro_1' },
        actor: { type: 'system', id: 'worker' },
        context
      })
    ).rejects.toThrow();
    expect(mocks.upsertResourceGroup).not.toHaveBeenCalled();
  });

  it('uses the organization-tenant resource actor for a project actor scope', async () => {
    mocks.findProject.mockResolvedValue({
      oid: 21n,
      id: 'pro_1',
      name: 'Project',
      organization,
      resourceGroup: { oid: 22n, resourceTenantOid: 1n }
    });
    mocks.ensureOrganizationActor.mockResolvedValue({ oid: 14n });

    await expect(
      ensureProjectActorAuditScope({
        organization,
        project: { id: 'pro_1' },
        organizationActor: { oid: 11n, id: 'oac_1' },
        context
      })
    ).resolves.toMatchObject({
      resourceTenantOid: 1n,
      resourceGroupOid: 22n,
      resourceActorOid: 14n,
      actor: { type: 'org_actor', id: 'oac_1' }
    });
    expect(mocks.ensureOrganizationActor).toHaveBeenCalledWith({
      resourceTenant: organizationScope.resourceTenant,
      organizationActorOid: 11n
    });
  });
});
