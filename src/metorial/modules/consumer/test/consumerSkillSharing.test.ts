import { beforeEach, describe, expect, it, vi } from 'vitest';

let {
  db,
  generateIdMock,
  upsertActorMock,
  createConsumerAccessMock,
  grantAccessMock,
  revokeAccessMock
} = vi.hoisted(() => ({
  db: {
    consumerSkill: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn()
    },
    consumerProfile: {
      findMany: vi.fn()
    },
    consumerGroup: {
      findUniqueOrThrow: vi.fn()
    },
    organizationMember: {
      findMany: vi.fn()
    }
  },
  generateIdMock: vi.fn(),
  upsertActorMock: vi.fn(),
  createConsumerAccessMock: vi.fn(),
  grantAccessMock: vi.fn(),
  revokeAccessMock: vi.fn()
}));

vi.mock('@metorial/db', () => ({
  db,
  ID: {
    generateId: generateIdMock
  },
  withTransaction: vi.fn(async (fn: any) => await fn(db))
}));

vi.mock('@metorial/module-subspace', () => ({
  subspaceSkillService: {
    upsertActor: upsertActorMock
  },
  subspaceSkillTemplateService: {}
}));

vi.mock('../src/services/consumerAccess/consumerAccess', () => ({
  consumerAccessService: {
    createConsumerAccess: createConsumerAccessMock
  }
}));

vi.mock('../src/services/consumerAccess/accessPolicy', () => ({
  consumerAccessPolicyService: {
    grantAccess: grantAccessMock,
    revokeAccess: revokeAccessMock
  }
}));

import { consumerSkillService } from '../src/services/consumerEntities/consumerSkill';

let organization = { oid: 1n };
let instance = { oid: 2n };
let skill = {
  oid: 3n,
  id: 'skill_1',
  createdByConsumerProfileOid: 4n
};
let consumerSurface = { oid: 5n };
let consumer = { oid: 6n, id: 'consumer_1', name: 'Consumer' };
let targetProfile = {
  oid: 7n,
  id: 'profile_1',
  consumerOid: consumer.oid,
  consumer,
  personalConsumerGroupOid: 8n,
  personalConsumerGroup: { oid: 8n },
  surface: consumerSurface
};

describe('consumer skill sharing', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    generateIdMock.mockResolvedValue('consumer_skill_1');
    db.consumerSkill.findUnique.mockResolvedValue(null);
    db.consumerSkill.upsert.mockImplementation(async (input: any) => input.create);
    db.consumerGroup.findUniqueOrThrow.mockResolvedValue(targetProfile.personalConsumerGroup);
    createConsumerAccessMock.mockResolvedValue({
      id: 'consumer_access_1',
      consumerGroup: targetProfile.personalConsumerGroup
    });
    upsertActorMock.mockResolvedValue({ storeParticipantId: 'store_participant_1' });
  });

  it('shares read access with a consumer through their personal group and Cargo actor', async () => {
    db.consumerProfile.findMany.mockResolvedValue([targetProfile]);

    await consumerSkillService.shareSkill({
      organization: organization as any,
      instance: instance as any,
      skill: skill as any,
      permission: 'read',
      targets: {
        consumerProfileIds: [targetProfile.id]
      }
    });

    expect(createConsumerAccessMock).toHaveBeenCalledWith({
      organization,
      consumerSurface,
      consumerGroup: targetProfile.personalConsumerGroup,
      access: {
        type: 'skill',
        skill
      }
    });
    expect(upsertActorMock).toHaveBeenCalledWith({
      instance,
      skillId: skill.id,
      consumer,
      permissions: ['content_read'],
      overridePermissions: true
    });
    expect(db.consumerSkill.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          permissions: ['read'],
          cargoStoreParticipantId: 'store_participant_1'
        })
      })
    );
  });

  it('blocks consumer shares to profiles outside shared groups', async () => {
    db.consumerProfile.findMany.mockResolvedValue([]);

    await expect(
      consumerSkillService.shareSkill({
        organization: organization as any,
        instance: instance as any,
        skill: skill as any,
        permission: 'read',
        consumerProfile: {
          oid: skill.createdByConsumerProfileOid,
          surfaceOid: consumerSurface.oid,
          consumer
        } as any,
        consumerGroups: [],
        targets: {
          consumerProfileIds: [targetProfile.id]
        }
      })
    ).rejects.toThrow();

    expect(createConsumerAccessMock).not.toHaveBeenCalled();
  });

  it('shares write access with organization members through their Cargo actor', async () => {
    let actor = { oid: 10n, id: 'actor_1' };
    let member = { oid: 11n, id: 'member_1', actor };
    db.organizationMember.findMany.mockResolvedValue([member]);

    await consumerSkillService.shareSkill({
      organization: organization as any,
      instance: instance as any,
      skill: skill as any,
      permission: 'write',
      targets: {
        organizationMemberIds: [member.id]
      }
    });

    expect(upsertActorMock).toHaveBeenCalledWith({
      instance,
      skillId: skill.id,
      organizationActor: actor,
      permissions: ['content_read', 'content_write'],
      overridePermissions: true
    });
  });

  it('blocks consumers from changing organization member skill access', async () => {
    let actor = { oid: 10n, id: 'actor_1' };
    let member = { oid: 11n, id: 'member_1', actor };

    await expect(
      consumerSkillService.shareSkill({
        organization: organization as any,
        instance: instance as any,
        skill: skill as any,
        permission: 'write',
        consumerProfile: {
          oid: skill.createdByConsumerProfileOid,
          surfaceOid: consumerSurface.oid,
          consumer
        } as any,
        consumerGroups: [],
        targets: {
          organizationMemberIds: [member.id]
        }
      })
    ).rejects.toThrow('Consumers cannot change organization member skill share access.');

    expect(db.organizationMember.findMany).not.toHaveBeenCalled();
    expect(upsertActorMock).not.toHaveBeenCalled();
  });

  it('blocks consumers from changing their own skill access', async () => {
    await expect(
      consumerSkillService.shareSkill({
        organization: organization as any,
        instance: instance as any,
        skill: skill as any,
        permission: 'none',
        consumerProfile: {
          id: targetProfile.id,
          oid: targetProfile.oid,
          surfaceOid: consumerSurface.oid,
          consumer
        } as any,
        consumerGroups: [],
        targets: {
          consumerProfileIds: [targetProfile.id]
        }
      })
    ).rejects.toThrow('Consumers cannot change their own skill share access.');

    expect(db.consumerProfile.findMany).not.toHaveBeenCalled();
    expect(upsertActorMock).not.toHaveBeenCalled();
  });

  it('blocks organization members from changing their own skill access', async () => {
    let actor = { oid: 10n, id: 'actor_1' };
    let member = { oid: 11n, id: 'member_1', actor };

    await expect(
      consumerSkillService.shareSkill({
        organization: organization as any,
        instance: instance as any,
        skill: skill as any,
        permission: 'none',
        currentOrganizationMember: member as any,
        targets: {
          organizationMemberIds: [member.id]
        }
      })
    ).rejects.toThrow('Organization members cannot change their own skill share access.');

    expect(db.organizationMember.findMany).not.toHaveBeenCalled();
    expect(upsertActorMock).not.toHaveBeenCalled();
  });
});
