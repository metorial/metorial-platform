import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  organizationFindMany: vi.fn(),
  organizationUpsert: vi.fn(),
  projectFindMany: vi.fn(),
  projectUpsert: vi.fn(),
  instanceFindMany: vi.fn(),
  instanceUpsert: vi.fn(),
  organizationActorFindMany: vi.fn(),
  organizationActorUpsert: vi.fn(),
  organizationMemberFindMany: vi.fn(),
  organizationMemberUpsert: vi.fn(),
  consumerFindMany: vi.fn(),
  consumerUpsert: vi.fn(),
  consumerDeleteMany: vi.fn(),
  instanceConsumerFindMany: vi.fn(),
  instanceConsumerUpsert: vi.fn(),
  consumerProfileFindMany: vi.fn(),
  consumerProfileUpsert: vi.fn(),
  metorialOrganizationFind: vi.fn(),
  metorialProjectFind: vi.fn(),
  tenantFindUnique: vi.fn(),
  tenantActorFindMany: vi.fn(),
  metorialActorFind: vi.fn(),
  metorialActorFindMany: vi.fn(),
  metorialMemberFind: vi.fn(),
  metorialInstanceFind: vi.fn(),
  metorialConsumerFind: vi.fn(),
  metorialInstanceConsumerFind: vi.fn(),
  ensureForProject: vi.fn(),
  ensureForInstance: vi.fn(),
  ensureForOrganizationActor: vi.fn()
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
    organization: {
      findMany: mocks.organizationFindMany,
      upsert: mocks.organizationUpsert
    },
    tenant: {
      findUnique: mocks.tenantFindUnique
    },
    tenantActor: {
      findMany: mocks.tenantActorFindMany
    },
    project: {
      findMany: mocks.projectFindMany,
      upsert: mocks.projectUpsert
    },
    instance: {
      findMany: mocks.instanceFindMany,
      upsert: mocks.instanceUpsert
    },
    organizationActor: {
      findMany: mocks.organizationActorFindMany,
      upsert: mocks.organizationActorUpsert
    },
    organizationMember: {
      findMany: mocks.organizationMemberFindMany,
      upsert: mocks.organizationMemberUpsert
    },
    consumer: {
      findMany: mocks.consumerFindMany,
      upsert: mocks.consumerUpsert,
      deleteMany: mocks.consumerDeleteMany
    },
    instanceConsumer: {
      findMany: mocks.instanceConsumerFindMany,
      upsert: mocks.instanceConsumerUpsert
    },
    consumerProfile: {
      findMany: mocks.consumerProfileFindMany,
      upsert: mocks.consumerProfileUpsert
    }
  }
}));

vi.mock('../lib/metorialDb', () => ({
  metorialDb: {
    organization: { findUniqueOrThrow: mocks.metorialOrganizationFind },
    project: { findUniqueOrThrow: mocks.metorialProjectFind },
    instance: { findUniqueOrThrow: mocks.metorialInstanceFind },
    organizationActor: {
      findUniqueOrThrow: mocks.metorialActorFind,
      findMany: mocks.metorialActorFindMany
    },
    organizationMember: { findUniqueOrThrow: mocks.metorialMemberFind },
    consumer: { findUniqueOrThrow: mocks.metorialConsumerFind },
    instanceConsumer: { findUniqueOrThrow: mocks.metorialInstanceConsumerFind }
  }
}));

vi.mock('./subspaceScope', () => ({
  subspaceScopeService: {
    ensureForProject: mocks.ensureForProject,
    ensureForInstance: mocks.ensureForInstance,
    ensureForOrganizationActor: mocks.ensureForOrganizationActor
  }
}));

import { metorialResourceService } from './metorialResource';

let createdAt = new Date('2026-01-01T00:00:00.000Z');
let updatedAt = new Date('2026-01-02T00:00:00.000Z');

let organization = {
  oid: 1n,
  id: 'org_1',
  type: 'default',
  status: 'active',
  slug: 'acme',
  name: 'Acme',
  image: { type: 'default' },
  deletedAt: null,
  createdAt,
  updatedAt
};

describe('Metorial resource synchronization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.organizationFindMany.mockResolvedValue([]);
    mocks.projectFindMany.mockResolvedValue([]);
    mocks.instanceFindMany.mockResolvedValue([]);
    mocks.organizationActorFindMany.mockResolvedValue([]);
    mocks.organizationMemberFindMany.mockResolvedValue([]);
    mocks.consumerFindMany.mockResolvedValue([]);
    mocks.instanceConsumerFindMany.mockResolvedValue([]);
    mocks.consumerProfileFindMany.mockResolvedValue([]);
    mocks.metorialActorFindMany.mockResolvedValue([]);
    mocks.tenantFindUnique.mockResolvedValue(null);
    mocks.tenantActorFindMany.mockResolvedValue([]);
    mocks.ensureForOrganizationActor.mockResolvedValue({ oid: 40n, id: 'act_40' });
  });

  it('creates the organization mirror with the exact Metorial oid and id', async () => {
    mocks.organizationUpsert.mockResolvedValue(organization);

    await metorialResourceService.syncOrganization(organization as any);

    expect(mocks.organizationUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { oid: 1n },
        create: expect.objectContaining({
          oid: 1n,
          id: 'org_1',
          slug: 'acme',
          createdAt,
          updatedAt
        })
      })
    );
  });

  it('refuses to overwrite an oid/id collision', async () => {
    mocks.organizationFindMany.mockResolvedValue([{ oid: 1n, id: 'org_different' }]);

    await expect(
      metorialResourceService.syncOrganization(organization as any)
    ).rejects.toThrow('identity mismatch');
    expect(mocks.organizationUpsert).not.toHaveBeenCalled();
  });

  it('links project and instance mirrors to their canonical Subspace scope', async () => {
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

    mocks.metorialOrganizationFind.mockResolvedValue(organization);
    mocks.metorialProjectFind.mockResolvedValue(project);
    mocks.ensureForProject.mockResolvedValue({ tenant: { oid: 20n } });
    mocks.ensureForInstance.mockResolvedValue({ environment: { oid: 30n } });
    mocks.projectUpsert.mockResolvedValue(project);
    mocks.instanceUpsert.mockResolvedValue(instance);

    await metorialResourceService.syncProject(project as any);
    await metorialResourceService.syncInstance(instance as any);

    expect(mocks.projectUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          oid: 2n,
          id: 'prj_2',
          organizationOid: 1n,
          tenantOid: 20n
        })
      })
    );
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
  });

  it('copies organization actors and members with exact identities', async () => {
    let actor = {
      oid: 4n,
      id: 'oac_4',
      type: 'member',
      isSystem: null,
      email: 'user@example.com',
      name: 'User',
      image: { type: 'default' },
      organizationOid: organization.oid,
      createdAt,
      updatedAt
    };
    let member = {
      oid: 5n,
      id: 'mem_5',
      role: 'admin',
      status: 'active',
      isV2Member: true,
      usesMetorialPersonal: false,
      lastActiveAt: null,
      deletedAt: null,
      organizationOid: organization.oid,
      actorOid: actor.oid,
      createdAt,
      updatedAt
    };
    mocks.metorialOrganizationFind.mockResolvedValue(organization);
    mocks.metorialActorFind.mockResolvedValue(actor);
    mocks.organizationUpsert.mockResolvedValue(organization);
    mocks.organizationActorUpsert.mockResolvedValue(actor);
    mocks.organizationMemberUpsert.mockResolvedValue(member);

    await metorialResourceService.syncOrganizationActor(actor as any);
    await metorialResourceService.syncOrganizationMember(member as any);

    expect(mocks.organizationActorUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { oid: 4n },
        create: expect.objectContaining({
          oid: 4n,
          id: 'oac_4',
          organizationOid: 1n
        })
      })
    );
    expect(mocks.organizationMemberUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { oid: 5n },
        create: expect.objectContaining({
          oid: 5n,
          id: 'mem_5',
          actorOid: 4n,
          organizationOid: 1n
        })
      })
    );
  });

  it('creates a tenant actor for each tenant of the organization', async () => {
    let actor = {
      oid: 4n,
      id: 'oac_4',
      type: 'member',
      isSystem: null,
      email: 'user@example.com',
      name: 'User',
      image: { type: 'default' },
      organizationOid: organization.oid,
      createdAt,
      updatedAt
    };
    let tenantA = { oid: 20n, id: 'tnt_20' };
    let tenantB = { oid: 21n, id: 'tnt_21' };
    mocks.metorialOrganizationFind.mockResolvedValue(organization);
    mocks.organizationUpsert.mockResolvedValue(organization);
    mocks.organizationActorUpsert.mockResolvedValue(actor);
    mocks.projectFindMany.mockResolvedValue([{ tenantOid: 20n }, { tenantOid: 20n }, { tenantOid: 21n }]);
    mocks.tenantFindUnique.mockImplementation(async ({ where }: { where: { oid: bigint } }) =>
      where.oid === 20n ? tenantA : tenantB
    );

    await metorialResourceService.syncOrganizationActor(actor as any);

    expect(mocks.ensureForOrganizationActor).toHaveBeenCalledTimes(2);
    expect(mocks.ensureForOrganizationActor).toHaveBeenCalledWith({
      tenant: tenantA,
      organizationActor: actor
    });
    expect(mocks.ensureForOrganizationActor).toHaveBeenCalledWith({
      tenant: tenantB,
      organizationActor: actor
    });
  });

  it('backfills organizationActorOid on tenant actors that already exist by public id', async () => {
    let actor = {
      oid: 4n,
      id: 'oac_4',
      type: 'member',
      isSystem: null,
      email: 'user@example.com',
      name: 'User',
      image: { type: 'default' },
      organizationOid: organization.oid,
      subspaceActorId: 'act_legacy',
      createdAt,
      updatedAt
    };
    let tenant = { oid: 22n, id: 'tnt_22' };
    mocks.metorialOrganizationFind.mockResolvedValue(organization);
    mocks.organizationUpsert.mockResolvedValue(organization);
    mocks.organizationActorUpsert.mockResolvedValue(actor);
    mocks.tenantActorFindMany.mockResolvedValue([{ tenantOid: 22n }]);
    mocks.tenantFindUnique.mockResolvedValue(tenant);

    await metorialResourceService.syncOrganizationActor(actor as any);

    expect(mocks.tenantActorFindMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { organizationActorId: 'oac_4' },
          { identifier: 'mte-oac-oac_4' },
          { id: 'act_legacy' }
        ]
      },
      select: { tenantOid: true }
    });
    expect(mocks.ensureForOrganizationActor).toHaveBeenCalledWith({
      tenant,
      organizationActor: actor
    });
  });

  it('links existing organization actors onto a newly synced tenant', async () => {
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
    let tenant = { oid: 20n, id: 'tnt_20' };
    let actor = {
      oid: 4n,
      id: 'oac_4',
      type: 'member',
      name: 'User',
      organizationOid: 1n
    };
    mocks.metorialOrganizationFind.mockResolvedValue(organization);
    mocks.organizationUpsert.mockResolvedValue(organization);
    mocks.ensureForProject.mockResolvedValue({ tenant });
    mocks.projectUpsert.mockResolvedValue(project);
    mocks.metorialActorFindMany.mockResolvedValue([actor]);

    await metorialResourceService.syncProject(project as any);

    expect(mocks.ensureForOrganizationActor).toHaveBeenCalledWith({
      tenant,
      organizationActor: actor
    });
  });

  it('copies consumers without out-of-scope references', async () => {
    let consumer = {
      oid: 6n,
      id: 'con_6',
      name: 'Consumer',
      email: 'consumer@example.com',
      organizationOid: organization.oid,
      organizationMemberOid: null,
      organizationActorOid: null,
      isOrganizationMember: false,
      isPortalConsumer: true,
      isManuallyCreated: false,
      isPending: false,
      createdAt,
      updatedAt
    };
    mocks.metorialOrganizationFind.mockResolvedValue(organization);
    mocks.organizationUpsert.mockResolvedValue(organization);
    mocks.consumerUpsert.mockResolvedValue(consumer);

    await metorialResourceService.syncConsumer(consumer as any);

    expect(mocks.consumerUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { oid: 6n },
        create: expect.objectContaining({
          oid: 6n,
          id: 'con_6',
          organizationOid: 1n,
          organizationMemberOid: null,
          organizationActorOid: null
        })
      })
    );
  });

  it('synchronizes optional consumer attribution before connecting it', async () => {
    let consumer = {
      oid: 6n,
      id: 'con_attributed',
      name: 'Attributed',
      email: 'attributed@example.com',
      organizationOid: organization.oid,
      organizationMemberOid: 5n,
      organizationActorOid: 9n,
      isOrganizationMember: true,
      isPortalConsumer: false,
      isManuallyCreated: false,
      isPending: false,
      createdAt,
      updatedAt
    };
    let member = { oid: 5n, actorOid: 4n };
    let actor = { oid: 9n };
    let syncMember = vi
      .spyOn(metorialResourceService, 'syncOrganizationMember')
      .mockResolvedValue({} as any);
    let syncActor = vi
      .spyOn(metorialResourceService, 'syncOrganizationActor')
      .mockResolvedValue({} as any);
    mocks.metorialOrganizationFind.mockResolvedValue(organization);
    mocks.metorialMemberFind.mockResolvedValue(member);
    mocks.metorialActorFind.mockResolvedValue(actor);
    mocks.organizationUpsert.mockResolvedValue(organization);
    mocks.consumerUpsert.mockResolvedValue(consumer);

    await metorialResourceService.syncConsumer(consumer as any);

    expect(syncMember).toHaveBeenCalledWith(member);
    expect(syncActor).toHaveBeenCalledWith(actor);
    expect(mocks.consumerUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          organizationMemberOid: 5n,
          organizationActorOid: 9n
        })
      })
    );

    syncMember.mockRestore();
    syncActor.mockRestore();
  });

  it('is idempotent for consumers and rejects oid/id identity collisions', async () => {
    let consumer = {
      oid: 6n,
      id: 'con_6',
      name: 'Consumer',
      email: 'consumer@example.com',
      organizationOid: organization.oid,
      organizationMemberOid: null,
      organizationActorOid: null,
      isOrganizationMember: false,
      isPortalConsumer: false,
      isManuallyCreated: false,
      isPending: false,
      createdAt,
      updatedAt
    };
    mocks.metorialOrganizationFind.mockResolvedValue(organization);
    mocks.organizationUpsert.mockResolvedValue(organization);
    mocks.consumerUpsert.mockResolvedValue(consumer);

    await metorialResourceService.syncConsumer(consumer as any);
    await metorialResourceService.syncConsumer(consumer as any);
    expect(mocks.consumerUpsert).toHaveBeenCalledTimes(2);

    mocks.consumerFindMany.mockResolvedValue([
      { oid: consumer.oid, id: 'con_other' },
      { oid: 7n, id: consumer.id }
    ]);
    await expect(metorialResourceService.syncConsumer(consumer as any)).rejects.toThrow(
      'Subspace consumer identity collision for oid 6 and id con_6'
    );
  });

  it('copies instance consumers and profiles after their parents', async () => {
    let instanceConsumer = {
      oid: 7n,
      id: 'ico_7',
      name: 'Consumer',
      email: 'consumer@example.com',
      instanceOid: 3n,
      consumerOid: 6n,
      organizationMemberOid: null,
      organizationActorOid: null,
      isPending: false,
      createdAt,
      updatedAt
    };
    let consumerProfile = {
      oid: 8n,
      id: 'cpf_8',
      status: 'deleted',
      inviteStatus: 'unset',
      name: 'Consumer',
      email: 'consumer@example.com',
      organizationOid: 1n,
      instanceOid: 3n,
      consumerOid: 6n,
      organizationMemberOid: null,
      organizationActorOid: null,
      deletedAt: updatedAt,
      createdAt,
      updatedAt
    };
    let syncInstance = vi
      .spyOn(metorialResourceService, 'syncInstance')
      .mockResolvedValue({} as any);
    let syncConsumer = vi
      .spyOn(metorialResourceService, 'syncConsumer')
      .mockResolvedValue({} as any);
    mocks.metorialInstanceFind.mockResolvedValue({ oid: 3n });
    mocks.metorialConsumerFind.mockResolvedValue({ oid: 6n });
    mocks.metorialInstanceConsumerFind.mockResolvedValue(instanceConsumer);
    mocks.instanceConsumerUpsert.mockResolvedValue(instanceConsumer);
    mocks.consumerProfileUpsert.mockResolvedValue(consumerProfile);

    await metorialResourceService.syncInstanceConsumer(instanceConsumer as any);
    let syncInstanceConsumer = vi
      .spyOn(metorialResourceService, 'syncInstanceConsumer')
      .mockResolvedValue({} as any);
    await metorialResourceService.syncConsumerProfile(consumerProfile as any);

    expect(syncInstance).toHaveBeenCalled();
    expect(syncConsumer).toHaveBeenCalled();
    expect(mocks.instanceConsumerUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ oid: 7n, instanceOid: 3n, consumerOid: 6n })
      })
    );
    expect(mocks.consumerProfileUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          oid: 8n,
          status: 'deleted',
          deletedAt: updatedAt,
          instanceOid: 3n,
          consumerOid: 6n
        })
      })
    );

    syncInstance.mockRestore();
    syncConsumer.mockRestore();
    syncInstanceConsumer.mockRestore();
  });

  it('deletes a hard-deleted consumer mirror by public id', async () => {
    await metorialResourceService.deleteConsumer('con_deleted');

    expect(mocks.consumerDeleteMany).toHaveBeenCalledWith({
      where: { id: 'con_deleted' }
    });
  });
});
