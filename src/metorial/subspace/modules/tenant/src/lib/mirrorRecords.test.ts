import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  organizationFindMany: vi.fn(),
  organizationFindFirst: vi.fn(),
  organizationFindUnique: vi.fn(),
  organizationUpdate: vi.fn(),
  organizationUpsert: vi.fn(),
  projectFindMany: vi.fn(),
  projectFindUnique: vi.fn(),
  projectUpsert: vi.fn(),
  projectUpdate: vi.fn(),
  instanceFindMany: vi.fn(),
  instanceFindUnique: vi.fn(),
  instanceUpsert: vi.fn(),
  instanceUpdate: vi.fn(),
  organizationActorFindMany: vi.fn(),
  organizationActorFindUnique: vi.fn(),
  organizationActorUpsert: vi.fn(),
  tenantUpdate: vi.fn(),
  environmentUpdate: vi.fn(),
  metorialOrganizationFindUnique: vi.fn(),
  metorialProjectFindUnique: vi.fn(),
  metorialInstanceFindUnique: vi.fn(),
  metorialOrganizationActorFindUnique: vi.fn()
}));

vi.mock('@metorial-subspace/db', () => ({
  db: {
    organization: {
      findMany: mocks.organizationFindMany,
      findFirst: mocks.organizationFindFirst,
      findUnique: mocks.organizationFindUnique,
      update: mocks.organizationUpdate,
      upsert: mocks.organizationUpsert
    },
    project: {
      findMany: mocks.projectFindMany,
      findUnique: mocks.projectFindUnique,
      upsert: mocks.projectUpsert,
      update: mocks.projectUpdate
    },
    instance: {
      findMany: mocks.instanceFindMany,
      findUnique: mocks.instanceFindUnique,
      upsert: mocks.instanceUpsert,
      update: mocks.instanceUpdate
    },
    organizationActor: {
      findMany: mocks.organizationActorFindMany,
      findUnique: mocks.organizationActorFindUnique,
      upsert: mocks.organizationActorUpsert
    },
    tenant: { update: mocks.tenantUpdate },
    environment: { update: mocks.environmentUpdate }
  }
}));

vi.mock('./metorialDb', () => ({
  metorialDb: {
    organization: { findUnique: mocks.metorialOrganizationFindUnique },
    project: { findUnique: mocks.metorialProjectFindUnique },
    instance: { findUnique: mocks.metorialInstanceFindUnique },
    organizationActor: { findUnique: mocks.metorialOrganizationActorFindUnique }
  }
}));

import {
  ensureInstanceMirror,
  ensureOrganizationActorMirror,
  ensureProjectMirror,
  linkEnvironmentToInstanceMirror,
  linkTenantToProjectMirror,
  upsertOrganizationMirror
} from './mirrorRecords';

let createdAt = new Date('2026-01-01T00:00:00.000Z');
let updatedAt = new Date('2026-01-02T00:00:00.000Z');

let organization = {
  oid: 1n,
  id: 'org_1',
  type: 'default',
  status: 'active',
  slug: 'acme',
  name: 'Acme',
  image: null,
  deletedAt: null,
  createdAt,
  updatedAt
};

let project = {
  oid: 2n,
  id: 'prj_2',
  status: 'active',
  slug: 'project',
  name: 'Project',
  organizationOid: 1n,
  deletedAt: null,
  createdAt,
  updatedAt
};

let instance = {
  oid: 3n,
  id: 'ins_3',
  type: 'production',
  status: 'active',
  slug: 'production',
  name: 'Production',
  projectOid: 2n,
  organizationOid: 1n,
  deletedAt: null,
  createdAt,
  updatedAt
};

let organizationActor = {
  oid: 4n,
  id: 'oac_4',
  type: 'member',
  isSystem: null,
  email: 'user@example.com',
  name: 'User',
  image: { type: 'default' },
  organizationOid: 1n,
  createdAt,
  updatedAt
};

describe('Mirror record creation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.organizationFindMany.mockResolvedValue([]);
    mocks.projectFindMany.mockResolvedValue([]);
    mocks.instanceFindMany.mockResolvedValue([]);
    mocks.organizationActorFindMany.mockResolvedValue([]);
    mocks.organizationUpsert.mockResolvedValue(organization);
    mocks.projectUpsert.mockResolvedValue(project);
    mocks.instanceUpsert.mockResolvedValue(instance);
    mocks.organizationActorUpsert.mockResolvedValue(organizationActor);
    mocks.metorialOrganizationFindUnique.mockResolvedValue(organization);
    mocks.metorialProjectFindUnique.mockResolvedValue(project);
    mocks.metorialInstanceFindUnique.mockResolvedValue(instance);
    mocks.metorialOrganizationActorFindUnique.mockResolvedValue(organizationActor);
  });

  it('creates the project mirror and its organization when it is missing', async () => {
    mocks.projectFindUnique.mockResolvedValue(null);

    let projectOid = await ensureProjectMirror({ projectOid: 2n, tenantOid: 20n });

    expect(projectOid).toBe(2n);
    expect(mocks.organizationUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { oid: 1n } })
    );
    expect(mocks.projectUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { oid: 2n },
        create: expect.objectContaining({ oid: 2n, id: 'prj_2', tenantOid: 20n })
      })
    );
    expect(mocks.organizationUpsert.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.projectUpsert.mock.invocationCallOrder[0]!
    );
  });

  it('leaves an existing project mirror untouched', async () => {
    mocks.projectFindUnique.mockResolvedValue({ oid: 2n, tenantOid: 20n });

    expect(await ensureProjectMirror({ projectOid: 2n, tenantOid: 20n })).toBe(2n);
    expect(mocks.projectUpsert).not.toHaveBeenCalled();
    expect(mocks.projectUpdate).not.toHaveBeenCalled();
    expect(mocks.metorialProjectFindUnique).not.toHaveBeenCalled();
  });

  it('repairs a project mirror that still points at a different tenant', async () => {
    mocks.projectFindUnique.mockResolvedValue({ oid: 2n, tenantOid: 99n });

    expect(await ensureProjectMirror({ projectOid: 2n, tenantOid: 20n })).toBe(2n);
    expect(mocks.projectUpdate).toHaveBeenCalledWith({
      where: { oid: 2n },
      data: { tenantOid: 20n }
    });
    expect(mocks.projectUpsert).not.toHaveBeenCalled();
  });

  it('repairs an instance mirror that still points at a different environment', async () => {
    mocks.instanceFindUnique.mockResolvedValue({
      oid: 3n,
      projectOid: 2n,
      environmentOid: 99n
    });

    let instance = await ensureInstanceMirror({
      instanceOid: 3n,
      environmentOid: 30n,
      tenantOid: 20n
    });

    expect(instance).toEqual({ oid: 3n, projectOid: 2n });
    expect(mocks.instanceUpdate).toHaveBeenCalledWith({
      where: { oid: 3n },
      data: { environmentOid: 30n }
    });
    expect(mocks.instanceUpsert).not.toHaveBeenCalled();
  });

  it('creates the project mirror before the instance mirror that points at it', async () => {
    mocks.instanceFindUnique.mockResolvedValue(null);
    mocks.projectFindUnique.mockResolvedValue(null);

    let instance = await ensureInstanceMirror({
      instanceOid: 3n,
      environmentOid: 30n,
      tenantOid: 20n
    });

    expect(instance?.oid).toBe(3n);
    expect(mocks.instanceUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          oid: 3n,
          id: 'ins_3',
          projectOid: 2n,
          environmentOid: 30n
        })
      })
    );
    expect(mocks.projectUpsert.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.instanceUpsert.mock.invocationCallOrder[0]!
    );
  });

  it('does not mirror resources that no longer exist in Metorial', async () => {
    mocks.projectFindUnique.mockResolvedValue(null);
    mocks.instanceFindUnique.mockResolvedValue(null);
    mocks.metorialProjectFindUnique.mockResolvedValue(null);
    mocks.metorialInstanceFindUnique.mockResolvedValue(null);

    expect(await ensureProjectMirror({ projectOid: 2n, tenantOid: 20n })).toBeNull();
    expect(
      await ensureInstanceMirror({ instanceOid: 3n, environmentOid: 30n, tenantOid: 20n })
    ).toBeNull();
    expect(mocks.projectUpsert).not.toHaveBeenCalled();
    expect(mocks.instanceUpsert).not.toHaveBeenCalled();
  });

  it('refuses to mirror a project whose identity collides with another mirror', async () => {
    mocks.projectFindUnique.mockResolvedValue(null);
    mocks.projectFindMany.mockResolvedValue([{ oid: 2n, id: 'prj_other' }]);

    await expect(ensureProjectMirror({ projectOid: 2n, tenantOid: 20n })).rejects.toThrow(
      'identity mismatch'
    );
    expect(mocks.projectUpsert).not.toHaveBeenCalled();
  });

  it('creates the organization mirror before the organization actor mirror', async () => {
    mocks.organizationActorFindUnique.mockResolvedValue(null);

    let organizationActorOid = await ensureOrganizationActorMirror({
      organizationActorOid: 4n
    });

    expect(organizationActorOid).toBe(4n);
    expect(mocks.organizationActorUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { oid: 4n },
        create: expect.objectContaining({ oid: 4n, id: 'oac_4', organizationOid: 1n })
      })
    );
    expect(mocks.organizationUpsert.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.organizationActorUpsert.mock.invocationCallOrder[0]!
    );
  });

  it('leaves an existing organization actor mirror untouched', async () => {
    mocks.organizationActorFindUnique.mockResolvedValue({ oid: 4n });

    expect(await ensureOrganizationActorMirror({ organizationActorOid: 4n })).toBe(4n);
    expect(mocks.organizationActorUpsert).not.toHaveBeenCalled();
    expect(mocks.metorialOrganizationActorFindUnique).not.toHaveBeenCalled();
  });

  it('does not mirror an organization actor that no longer exists in Metorial', async () => {
    mocks.organizationActorFindUnique.mockResolvedValue(null);
    mocks.metorialOrganizationActorFindUnique.mockResolvedValue(null);

    expect(await ensureOrganizationActorMirror({ organizationActorOid: 4n })).toBeNull();
    expect(mocks.organizationActorUpsert).not.toHaveBeenCalled();
  });

  it('writes tenant.projectOid only after the project mirror exists', async () => {
    mocks.projectFindUnique.mockResolvedValue(null);

    let projectOid = await linkTenantToProjectMirror({
      tenant: { oid: 20n, projectOid: null },
      projectOid: 2n
    });

    expect(projectOid).toBe(2n);
    expect(mocks.tenantUpdate).toHaveBeenCalledWith({
      where: { oid: 20n },
      data: { projectOid: 2n }
    });
    expect(mocks.projectUpsert.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.tenantUpdate.mock.invocationCallOrder[0]!
    );
  });

  it('repairs a tenant that already references a project mirror that was never created', async () => {
    mocks.projectFindUnique.mockResolvedValue(null);

    let projectOid = await linkTenantToProjectMirror({
      tenant: { oid: 20n, projectOid: 2n },
      projectOid: 2n
    });

    expect(projectOid).toBe(2n);
    expect(mocks.projectUpsert).toHaveBeenCalled();
    expect(mocks.tenantUpdate).not.toHaveBeenCalled();
  });

  it('fails when the project cannot be mirrored', async () => {
    mocks.projectFindUnique.mockResolvedValue(null);
    mocks.metorialProjectFindUnique.mockResolvedValue(null);

    await expect(
      linkTenantToProjectMirror({
        tenant: { oid: 20n, projectOid: null },
        projectOid: 2n
      })
    ).rejects.toThrow('the project mirror could not be created');
    expect(mocks.tenantUpdate).not.toHaveBeenCalled();
  });

  it('writes environment.instanceOid only after the instance mirror exists', async () => {
    mocks.projectFindUnique.mockResolvedValue({ oid: 2n });
    mocks.instanceFindUnique.mockResolvedValue(null);

    let instanceOid = await linkEnvironmentToInstanceMirror({
      environment: { oid: 30n, tenantOid: 20n, instanceOid: null },
      instanceOid: 3n
    });

    expect(instanceOid).toBe(3n);
    expect(mocks.environmentUpdate).toHaveBeenCalledWith({
      where: { oid: 30n },
      data: { instanceOid: 3n, projectOid: 2n }
    });
    expect(mocks.instanceUpsert.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.environmentUpdate.mock.invocationCallOrder[0]!
    );
  });

  it('repairs an environment that already references an instance mirror that was never created', async () => {
    mocks.projectFindUnique.mockResolvedValue({ oid: 2n });
    mocks.instanceFindUnique.mockResolvedValue(null);

    let instanceOid = await linkEnvironmentToInstanceMirror({
      environment: { oid: 30n, tenantOid: 20n, instanceOid: 3n },
      instanceOid: 3n
    });

    expect(instanceOid).toBe(3n);
    expect(mocks.instanceUpsert).toHaveBeenCalled();
    expect(mocks.environmentUpdate).toHaveBeenCalledWith({
      where: { oid: 30n },
      data: { instanceOid: 3n, projectOid: 2n }
    });
  });

  it('fails when the instance cannot be mirrored', async () => {
    mocks.instanceFindUnique.mockResolvedValue(null);
    mocks.metorialInstanceFindUnique.mockResolvedValue(null);

    await expect(
      linkEnvironmentToInstanceMirror({
        environment: { oid: 30n, tenantOid: 20n, instanceOid: null },
        instanceOid: 3n
      })
    ).rejects.toThrow('the instance mirror could not be created');
    expect(mocks.environmentUpdate).not.toHaveBeenCalled();
  });

  it('refreshes a stale organization mirror that still holds the claimed slug', async () => {
    let conflict = { oid: 9n, id: 'org_old', slug: 'acme' };
    mocks.organizationUpsert
      .mockRejectedValueOnce({ code: 'P2002' })
      .mockResolvedValueOnce(organization);
    mocks.organizationFindFirst.mockResolvedValue(conflict);
    mocks.metorialOrganizationFindUnique.mockResolvedValue({
      ...organization,
      oid: 9n,
      id: 'org_old',
      slug: 'acme-renamed'
    });

    await expect(upsertOrganizationMirror(organization as any)).resolves.toEqual(organization);

    expect(mocks.organizationUpdate).toHaveBeenCalledWith({
      where: { oid: 9n },
      data: expect.objectContaining({ slug: 'acme-renamed' })
    });
    expect(mocks.organizationUpsert).toHaveBeenCalledTimes(2);
  });

  it('parks the occupant slug when Metorial no longer owns it', async () => {
    let conflict = { oid: 9n, id: 'org_old', slug: 'acme' };
    mocks.organizationUpsert
      .mockRejectedValueOnce({ code: 'P2002' })
      .mockResolvedValueOnce(organization);
    mocks.organizationFindFirst.mockResolvedValue(conflict);
    mocks.metorialOrganizationFindUnique.mockResolvedValue(null);

    await expect(upsertOrganizationMirror(organization as any)).resolves.toEqual(organization);

    expect(mocks.organizationUpdate).toHaveBeenCalledWith({
      where: { oid: 9n },
      data: { slug: 'acme--org_old' }
    });
  });

  it('updates the existing organization when the slug conflict is a create/update race', async () => {
    mocks.organizationUpsert.mockRejectedValue({ code: 'P2002' });
    mocks.organizationFindFirst.mockResolvedValue(null);
    mocks.organizationUpdate.mockResolvedValue(organization);

    await expect(upsertOrganizationMirror(organization as any)).resolves.toEqual(organization);

    expect(mocks.organizationUpdate).toHaveBeenCalledWith({
      where: { oid: 1n },
      data: expect.objectContaining({ slug: 'acme', name: 'Acme' })
    });
  });

  it('returns the existing organization when the follow-up update still conflicts', async () => {
    mocks.organizationUpsert.mockRejectedValue({ code: 'P2002' });
    mocks.organizationFindFirst.mockResolvedValue(null);
    mocks.organizationUpdate.mockRejectedValue({ code: 'P2002' });
    mocks.organizationFindUnique.mockResolvedValue(organization);

    await expect(upsertOrganizationMirror(organization as any)).resolves.toEqual(organization);
  });

  it('rethrows unique conflicts when the organization cannot be recovered', async () => {
    let error = { code: 'P2002' };
    mocks.organizationUpsert.mockRejectedValue(error);
    mocks.organizationFindFirst.mockResolvedValue(null);
    mocks.organizationUpdate.mockRejectedValue({ code: 'P2002' });
    mocks.organizationFindUnique.mockResolvedValue(null);

    await expect(upsertOrganizationMirror(organization as any)).rejects.toBe(error);
  });
});
