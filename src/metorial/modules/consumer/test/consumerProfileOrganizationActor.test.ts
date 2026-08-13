import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => {
  let db = {
    accessTag: { create: vi.fn() },
    consumer: { findUnique: vi.fn() },
    consumerGroup: { create: vi.fn() },
    consumerOrganizationActor: { upsert: vi.fn() },
    consumerProfile: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn()
    },
    instance: {
      findFirstOrThrow: vi.fn(),
      findMany: vi.fn()
    },
    instanceConsumer: {
      findMany: vi.fn(),
      findUnique: vi.fn()
    },
    organization: { findFirstOrThrow: vi.fn() },
    organizationActor: { findUnique: vi.fn() },
    organizationMember: { findUnique: vi.fn() }
  };

  return {
    db,
    createOrganizationActor: vi.fn(),
    getSystemActor: vi.fn(),
    upsertConsumer: vi.fn(),
    profileCreatedAdd: vi.fn(),
    profileUpdatedAdd: vi.fn(),
    fire: vi.fn()
  };
});

vi.mock('@metorial/db', () => ({
  db: mocks.db,
  ID: { generateId: vi.fn(async prefix => `${prefix}_generated`) },
  withTransaction: vi.fn(async callback => await callback(mocks.db))
}));

vi.mock('@metorial/consumer-auth', () => ({
  getEffectiveConsumerGroups: vi.fn(),
  normalizeStringList: vi.fn(values => values ?? [])
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_: string, factory: () => unknown) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('@metorial/fabric', () => ({
  Fabric: { fire: mocks.fire }
}));

vi.mock('@metorial/lock', () => ({
  createLock: vi.fn(() => ({
    usingLock: vi.fn(async (_key, callback) => await callback())
  }))
}));

vi.mock('@metorial/module-organization', () => ({
  namespaceService: {},
  organizationActorService: {
    createOrganizationActor: mocks.createOrganizationActor,
    getSystemActor: mocks.getSystemActor
  }
}));

vi.mock('@metorial/module-search', () => ({
  searchConsumerIds: vi.fn()
}));

vi.mock('../src/queues/lifecycle/consumerInvite', () => ({
  consumerInviteUpdatedQueue: { addMany: vi.fn() }
}));

vi.mock('../src/queues/lifecycle/consumerProfile', () => ({
  consumerProfileCreatedQueue: { add: mocks.profileCreatedAdd },
  consumerProfileUpdatedQueue: { add: mocks.profileUpdatedAdd }
}));

vi.mock('../src/queues/reconcileUserConsumer', () => ({
  reconcileUserConsumersQueue: { add: vi.fn() }
}));

vi.mock('../src/queues/syncUserConsumer', () => ({
  syncUserConsumersQueue: { add: vi.fn() }
}));

vi.mock('../src/services/consumers/consumer', () => ({
  consumerService: { upsertConsumer: mocks.upsertConsumer }
}));

vi.mock('../src/services/consumers/consumerSurface', () => ({
  consumerSurfaceInclude: {},
  consumerSurfaceService: {
    enrichConsumerSurfaces: vi.fn(async ({ consumerSurfaces }) => consumerSurfaces)
  }
}));

import { consumerProfileService } from '../src/services/consumers/consumerProfile';

let organization = { id: 'org_1', oid: 1n };
let systemActor = { id: 'oac_system', oid: 2n, type: 'system' };
let instanceConsumer = {
  id: 'inc_1',
  oid: 3n,
  instanceOid: 4n,
  consumerOid: 5n,
  organizationMemberOid: null,
  organizationActorOid: null
};
let portalSurface = {
  id: 'csf_portal',
  oid: 6n,
  instanceOid: 4n,
  organizationOid: 1n,
  type: 'portal',
  isInternal: false
};

let profile = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 'cop_1',
    oid: 7n,
    status: 'active',
    name: 'Consumer',
    email: 'consumer@example.com',
    organizationOid: 1n,
    instanceOid: 4n,
    surfaceOid: 6n,
    consumerOid: 5n,
    organizationMemberOid: null,
    organizationActorOid: null,
    organization,
    surface: portalSurface,
    ...overrides
  }) as any;

describe('consumer profile organization actors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSystemActor.mockResolvedValue(systemActor);
    mocks.createOrganizationActor.mockResolvedValue({
      id: 'oac_profile',
      oid: 8n,
      type: 'consumer_profile'
    });
    mocks.db.instanceConsumer.findUnique.mockResolvedValue(instanceConsumer);
  });

  it('creates a dedicated actor and clears inherited member links', async () => {
    let consumerProfile = profile({
      organizationMemberOid: 20n,
      organizationActorOid: 21n
    });
    mocks.db.consumerProfile.findUnique.mockResolvedValue(consumerProfile);
    mocks.db.organizationActor.findUnique.mockResolvedValue({
      oid: 21n,
      type: 'member',
      consumerProfile: { oid: 7n }
    });
    mocks.db.consumerProfile.update.mockImplementation(async ({ data }) => ({
      ...consumerProfile,
      ...data
    }));

    await consumerProfileService.reconcileConsumerProfileOrganizationActor({
      consumerProfile
    });

    expect(mocks.createOrganizationActor).toHaveBeenCalledWith({
      input: {
        type: 'consumer_profile',
        name: 'Consumer',
        email: 'consumer@example.com'
      },
      organization,
      performedBy: { type: 'actor', actor: systemActor }
    });
    expect(mocks.db.consumerOrganizationActor.upsert).toHaveBeenCalledWith({
      where: {
        consumerOid_organizationActorOid: {
          consumerOid: 5n,
          organizationActorOid: 8n
        }
      },
      create: {
        consumerOid: 5n,
        organizationActorOid: 8n
      },
      update: {}
    });
    expect(mocks.db.consumerProfile.update).toHaveBeenCalledWith({
      where: { oid: 7n },
      data: {
        organizationMemberOid: null,
        organizationActorOid: 8n
      }
    });
    expect(mocks.db.consumer).not.toHaveProperty('update');
    expect(mocks.db.instanceConsumer).not.toHaveProperty('update');
  });

  it('keeps an actor that belongs only to the profile', async () => {
    let consumerProfile = profile({ organizationActorOid: 8n });
    mocks.db.consumerProfile.findUnique.mockResolvedValue(consumerProfile);
    mocks.db.organizationActor.findUnique.mockResolvedValue({
      oid: 8n,
      type: 'consumer_profile',
      consumerProfile: { oid: 7n }
    });

    await consumerProfileService.reconcileConsumerProfileOrganizationActor({
      consumerProfile
    });

    expect(mocks.createOrganizationActor).not.toHaveBeenCalled();
    expect(mocks.db.consumerProfile.update).not.toHaveBeenCalled();
  });

  it('replaces a consumer profile actor linked to another profile', async () => {
    let consumerProfile = profile({ organizationActorOid: 8n });
    mocks.db.consumerProfile.findUnique.mockResolvedValue(consumerProfile);
    mocks.createOrganizationActor.mockResolvedValue({
      id: 'oac_profile_replacement',
      oid: 9n,
      type: 'consumer_profile'
    });
    mocks.db.organizationActor.findUnique.mockResolvedValue({
      oid: 8n,
      type: 'consumer_profile',
      consumerProfile: { oid: 9n }
    });

    await consumerProfileService.reconcileConsumerProfileOrganizationActor({
      consumerProfile
    });

    expect(mocks.createOrganizationActor).toHaveBeenCalledOnce();
    expect(mocks.db.consumerProfile.update).toHaveBeenCalledWith({
      where: { oid: 7n },
      data: {
        organizationMemberOid: null,
        organizationActorOid: 9n
      }
    });
  });

  it.each([
    {
      source: 'profile',
      profileMemberOid: 20n,
      instanceMemberOid: 30n,
      consumerMemberOid: 40n,
      expectedMemberOid: 20n
    },
    {
      source: 'instance consumer',
      profileMemberOid: null,
      instanceMemberOid: 30n,
      consumerMemberOid: 40n,
      expectedMemberOid: 30n
    },
    {
      source: 'consumer',
      profileMemberOid: null,
      instanceMemberOid: null,
      consumerMemberOid: 40n,
      expectedMemberOid: 40n
    }
  ])('uses the organization member from the $source', async testCase => {
    let memberSurface = { ...portalSurface, type: 'organization_members' };
    let consumerProfile = profile({
      surface: memberSurface,
      organizationMemberOid: testCase.profileMemberOid
    });
    mocks.db.consumerProfile.findUnique.mockResolvedValue(consumerProfile);
    mocks.db.instanceConsumer.findUnique.mockResolvedValue({
      ...instanceConsumer,
      organizationMemberOid: testCase.instanceMemberOid
    });
    mocks.db.consumer.findUnique.mockResolvedValue({
      organizationMemberOid: testCase.consumerMemberOid
    });
    mocks.db.organizationMember.findUnique.mockResolvedValue({
      oid: testCase.expectedMemberOid,
      actorOid: 50n
    });

    await consumerProfileService.reconcileConsumerProfileOrganizationActor({
      consumerProfile
    });

    expect(mocks.db.consumerProfile.update).toHaveBeenCalledWith({
      where: { oid: 7n },
      data: {
        organizationMemberOid: testCase.expectedMemberOid,
        organizationActorOid: 50n
      }
    });
    expect(mocks.createOrganizationActor).not.toHaveBeenCalled();
  });

  it('rejects organization member profiles without an organization member', async () => {
    let memberSurface = { ...portalSurface, type: 'organization_members' };
    let consumerProfile = profile({
      surface: memberSurface,
      organizationActorOid: 21n
    });
    mocks.db.consumerProfile.findUnique.mockResolvedValue(consumerProfile);
    mocks.db.consumer.findUnique.mockResolvedValue({ organizationMemberOid: null });

    await expect(
      consumerProfileService.reconcileConsumerProfileOrganizationActor({
        consumerProfile
      })
    ).rejects.toThrow();

    expect(mocks.db.consumerProfile.update).not.toHaveBeenCalled();
  });

  it('gives a newly created portal profile its own actor', async () => {
    let instance = { id: 'ins_1', oid: 4n };
    let createdProfile = profile({
      organizationActorOid: 8n,
      surface: portalSurface
    });
    mocks.db.organization.findFirstOrThrow.mockResolvedValue(organization);
    mocks.db.instance.findFirstOrThrow.mockResolvedValue(instance);
    mocks.db.instance.findMany.mockResolvedValue([instance]);
    mocks.upsertConsumer.mockResolvedValue(instanceConsumer);
    mocks.db.consumerProfile.findFirst.mockResolvedValue(null);
    mocks.db.accessTag.create.mockResolvedValue({ oid: 60n });
    mocks.db.consumerGroup.create.mockResolvedValue({ oid: 61n });
    mocks.db.consumerProfile.create.mockResolvedValue(createdProfile);

    await consumerProfileService.ensureConsumerProfile({
      surface: portalSurface as any,
      name: 'Consumer',
      email: 'consumer@example.com'
    });

    expect(mocks.db.consumerProfile.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationMemberOid: null,
          organizationActorOid: 8n
        })
      })
    );
    expect(mocks.profileCreatedAdd).toHaveBeenCalledWith({
      consumerProfileId: 'cop_1'
    });
  });
});
