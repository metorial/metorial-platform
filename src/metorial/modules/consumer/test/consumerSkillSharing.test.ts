import { beforeEach, describe, expect, it, vi } from 'vitest';

let {
  db,
  createConsumerAccessMock,
  deleteConsumerAccessMock,
  grantAccessMock,
  revokeAccessMock,
  ensureConsumerActorMock,
  ensureOrganizationActorMock,
  getSkillByIdMock,
  upsertSkillActorMock,
  getSkillTemplateByIdMock,
  createSkillMock
} = vi.hoisted(() => ({
  db: {
    consumerProfile: {
      findMany: vi.fn()
    },
    consumerGroup: {
      findUniqueOrThrow: vi.fn()
    },
    consumerAccess: {
      findMany: vi.fn()
    },
    organizationMember: {
      findMany: vi.fn()
    },
    skill: {
      findFirst: vi.fn()
    }
  },
  createConsumerAccessMock: vi.fn(),
  deleteConsumerAccessMock: vi.fn(),
  grantAccessMock: vi.fn(),
  revokeAccessMock: vi.fn(),
  ensureConsumerActorMock: vi.fn(),
  ensureOrganizationActorMock: vi.fn(),
  getSkillByIdMock: vi.fn(),
  upsertSkillActorMock: vi.fn(),
  getSkillTemplateByIdMock: vi.fn(),
  createSkillMock: vi.fn()
}));

vi.mock('@metorial/db', () => ({
  db,
  ID: {
    generateId: vi.fn()
  }
}));

vi.mock('@metorial/cargo-module-skill', () => ({
  skillResourceService: {
    copyDelegatedTemplateResourcesToSkill: vi.fn(),
    hydrateSkill: vi.fn()
  },
  skillTemplateService: {
    getSkillTemplateById: getSkillTemplateByIdMock
  },
  skillService: {
    createSkill: createSkillMock,
    getSkillById: getSkillByIdMock,
    upsertSkillActor: upsertSkillActorMock
  }
}));

vi.mock('@metorial/module-access', () => ({
  consumerSkillWriteRoles: ['consumer#instance.skill:write'],
  accessTagService: {
    getAccessTagFilter: vi.fn(async ({ tags, roles }) => ({
      some: {
        accessTagOid: { in: tags },
        accessTagPolicy: { roles: { hasSome: roles } }
      }
    }))
  }
}));

vi.mock('@metorial/module-resource-tenant', () => ({
  resolveResourceScopeForOwner: vi.fn(async () => ({
    resourceTenant: { oid: 20n, id: 'rtn_1' },
    resourceGroup: { oid: 21n, id: 'rgr_1' }
  })),
  resourceActorService: {
    ensureConsumerActor: ensureConsumerActorMock,
    ensureOrganizationActor: ensureOrganizationActorMock
  }
}));

vi.mock('../src/services/consumerAccess/consumerAccess', () => ({
  consumerAccessService: {
    createConsumerAccess: createConsumerAccessMock,
    deleteConsumerAccess: deleteConsumerAccessMock
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
let instance = { oid: 2n, id: 'ins_1' };
let skill = {
  oid: 3n,
  id: 'skill_1',
  instanceOid: instance.oid,
  createdByResourceActorOid: null,
  createdByOrganizationActorOid: null,
  createdByConsumerOid: null,
  createdByConsumerProfileOid: null
};
let consumerSurface = { oid: 5n };
let consumer = { oid: 6n, id: 'consumer_1', name: 'Consumer' };
let personalConsumerGroup = { oid: 8n, accessTagOid: 9n };
let targetProfile = {
  oid: 7n,
  id: 'profile_1',
  accessTagOid: 10n,
  consumerOid: consumer.oid,
  consumer,
  personalConsumerGroupOid: personalConsumerGroup.oid,
  personalConsumerGroup,
  surface: consumerSurface
};

describe('consumer skill sharing', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    db.consumerGroup.findUniqueOrThrow.mockResolvedValue(personalConsumerGroup);
    db.consumerAccess.findMany.mockResolvedValue([]);
    createConsumerAccessMock.mockResolvedValue({
      id: 'consumer_access_1',
      consumerGroup: personalConsumerGroup
    });
    ensureConsumerActorMock.mockResolvedValue({
      oid: 30n,
      id: 'resource_actor_consumer'
    });
    ensureOrganizationActorMock.mockResolvedValue({
      oid: 31n,
      id: 'resource_actor_member'
    });
    getSkillByIdMock.mockResolvedValue({
      ...skill,
      store: { oid: 40n, id: 'store_1' }
    });
  });

  it('shares consumer read access through access tags without materializing a participant', async () => {
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
      consumerGroup: personalConsumerGroup,
      access: {
        type: 'skill',
        skill
      }
    });
    expect(revokeAccessMock).toHaveBeenCalledWith(
      expect.objectContaining({
        permission: 'skill_write',
        subject: { consumerGroup: personalConsumerGroup }
      })
    );
    expect(upsertSkillActorMock).not.toHaveBeenCalled();
  });

  it('grants direct consumer write access through the scoped access policy', async () => {
    db.consumerProfile.findMany.mockResolvedValue([targetProfile]);

    await consumerSkillService.shareSkill({
      organization: organization as any,
      instance: instance as any,
      skill: skill as any,
      permission: 'write',
      targets: {
        consumerProfileIds: [targetProfile.id]
      }
    });

    expect(grantAccessMock).toHaveBeenCalledWith(
      expect.objectContaining({
        permission: 'skill_write',
        subject: { consumerGroup: personalConsumerGroup },
        resource: { skill }
      })
    );
    expect(revokeAccessMock).not.toHaveBeenCalled();
    expect(upsertSkillActorMock).not.toHaveBeenCalled();
  });

  it('revokes consumer access by deleting the personal-group access record', async () => {
    let access = { oid: 50n };
    db.consumerProfile.findMany.mockResolvedValue([targetProfile]);
    db.consumerAccess.findMany.mockResolvedValue([access]);

    await consumerSkillService.shareSkill({
      organization: organization as any,
      instance: instance as any,
      skill: skill as any,
      permission: 'none',
      targets: {
        consumerProfileIds: [targetProfile.id]
      }
    });

    expect(deleteConsumerAccessMock).toHaveBeenCalledWith({
      organization,
      consumerAccess: access
    });
    expect(upsertSkillActorMock).not.toHaveBeenCalled();
  });

  it('blocks consumer shares to profiles outside shared groups', async () => {
    db.skill.findFirst.mockResolvedValue({ oid: skill.oid });
    db.consumerProfile.findMany.mockResolvedValue([]);

    await expect(
      consumerSkillService.shareSkill({
        organization: organization as any,
        instance: instance as any,
        skill: skill as any,
        permission: 'read',
        consumerProfile: {
          ...targetProfile,
          surfaceOid: consumerSurface.oid
        } as any,
        consumerGroups: [],
        targets: {
          consumerProfileIds: ['profile_outside']
        }
      })
    ).rejects.toThrow();

    expect(createConsumerAccessMock).not.toHaveBeenCalled();
  });

  it('shares organization-member access through the native store participant', async () => {
    let actor = { oid: 11n, id: 'actor_1' };
    let member = { oid: 12n, id: 'member_1', actor };
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

    expect(upsertSkillActorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'resource_actor_member',
        permissions: ['content_read', 'content_write'],
        overridePermissions: true
      })
    );
  });

  it('prevents native and legacy owners from being downgraded', async () => {
    db.consumerProfile.findMany.mockResolvedValue([targetProfile]);
    ensureConsumerActorMock.mockResolvedValue({
      oid: 30n,
      id: 'resource_actor_consumer'
    });

    await expect(
      consumerSkillService.shareSkill({
        organization: organization as any,
        instance: instance as any,
        skill: {
          ...skill,
          createdByResourceActorOid: 30n
        } as any,
        permission: 'read',
        targets: {
          consumerProfileIds: [targetProfile.id]
        }
      })
    ).rejects.toThrow('The skill owner cannot be removed or downgraded.');

    await expect(
      consumerSkillService.shareSkill({
        organization: organization as any,
        instance: instance as any,
        skill: {
          ...skill,
          createdByConsumerProfileOid: targetProfile.oid
        } as any,
        permission: 'none',
        targets: {
          consumerProfileIds: [targetProfile.id]
        }
      })
    ).rejects.toThrow('The skill owner cannot be removed or downgraded.');
  });

  it('checks explicit templates against the consumer access tags', async () => {
    getSkillTemplateByIdMock.mockRejectedValue(new Error('Template not found'));

    await expect(
      consumerSkillService.createConsumerSkill({
        organization: organization as any,
        instance: instance as any,
        consumerSurface: {
          ...consumerSurface,
          allowConsumerSkillAuthoring: true
        } as any,
        consumerProfile: targetProfile as any,
        consumerGroups: [
          {
            oid: 60n,
            accessTagOid: 61n
          }
        ] as any,
        input: {
          name: 'Consumer skill',
          templateId: 'skt_private'
        }
      })
    ).rejects.toThrow('Template not found');

    expect(getSkillTemplateByIdMock).toHaveBeenCalledWith(
      expect.objectContaining({
        skillTemplateId: 'skt_private',
        accessTags: [targetProfile.accessTagOid, 61n]
      })
    );
    expect(createSkillMock).not.toHaveBeenCalled();
  });

  it('blocks callers from changing their own share targets', async () => {
    await expect(
      consumerSkillService.shareSkill({
        organization: organization as any,
        instance: instance as any,
        skill: skill as any,
        permission: 'none',
        consumerProfile: targetProfile as any,
        consumerGroups: [],
        targets: {
          consumerProfileIds: [targetProfile.id]
        }
      })
    ).rejects.toThrow('Consumers cannot change their own skill share access.');

    let member = { id: 'member_1' };
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
  });
});
