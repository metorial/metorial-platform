import { beforeEach, describe, expect, it, vi } from 'vitest';

let {
  db,
  transactionDb,
  createConsumerAccessMock,
  deleteConsumerAccessMock,
  grantAccessMock,
  revokeSkillParticipantAccessMock,
  ensureConsumerActorMock,
  ensureOrganizationActorMock,
  getSkillByIdMock,
  setSkillParticipantAccessRoleMock,
  getSkillTemplateByIdMock,
  createSkillMock,
  withTransactionMock
} = vi.hoisted(() => ({
  db: {
    consumerProfile: {
      findMany: vi.fn(),
      findUnique: vi.fn()
    },
    consumerGroup: {
      findUniqueOrThrow: vi.fn(),
      findMany: vi.fn()
    },
    consumerAccess: {
      findMany: vi.fn()
    },
    accessTagEntity: {
      findMany: vi.fn()
    },
    storeParticipant: {
      findMany: vi.fn()
    },
    organizationMember: {
      findMany: vi.fn()
    },
    skill: {
      findFirst: vi.fn()
    },
    project: {
      findUniqueOrThrow: vi.fn(async () => ({ oid: 2n }))
    }
  },
  transactionDb: {
    consumerAccess: {
      findMany: vi.fn()
    }
  },
  createConsumerAccessMock: vi.fn(),
  deleteConsumerAccessMock: vi.fn(),
  grantAccessMock: vi.fn(),
  revokeSkillParticipantAccessMock: vi.fn(),
  ensureConsumerActorMock: vi.fn(),
  ensureOrganizationActorMock: vi.fn(),
  getSkillByIdMock: vi.fn(),
  setSkillParticipantAccessRoleMock: vi.fn(),
  getSkillTemplateByIdMock: vi.fn(),
  createSkillMock: vi.fn(),
  withTransactionMock: vi.fn(
    async (fn: (database: unknown) => unknown) => await fn(transactionDb)
  )
}));

vi.mock('@metorial/db', () => ({
  db,
  withTransaction: withTransactionMock,
  ID: {
    generateId: vi.fn()
  }
}));

vi.mock('@metorial/module-skill', () => ({
  skillResourceService: {
    copyDelegatedTemplateResourcesToSkill: vi.fn(),
    hydrateSkill: vi.fn()
  },
  skillParticipantService: {
    setSkillParticipantAccessRole: setSkillParticipantAccessRoleMock
  },
  skillService: {
    createSkill: createSkillMock,
    getSkillById: getSkillByIdMock
  }
}));

vi.mock('@metorial/module-skill-templates', () => ({
  skillTemplateService: {
    getSkillTemplateById: getSkillTemplateByIdMock
  }
}));

vi.mock('@metorial/module-access', () => ({
  consumerSkillWriteRoles: ['consumer#instance.skill:write'],
  consumerSkillManageAccessRoles: ['consumer#instance.skill:manage_access'],
  createResourceAuthorization: ({ resourceActor, accessTags }: any) => ({
    type: 'restricted',
    resourceActor,
    accessTags
  }),
  accessTagService: {
    getAccessTagFilter: vi.fn(async ({ tags, roles }) => ({
      some: {
        accessTagOid: { in: tags },
        accessTagPolicy: { roles: { hasSome: roles } }
      }
    }))
  }
}));

vi.mock('@metorial/module-resource-actor', () => ({
  resourceActorService: {
    ensureConsumerActor: ensureConsumerActorMock,
    ensureConsumerProfileActor: ensureConsumerActorMock,
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
    revokeSkillParticipantAccessForPersonalGroup: revokeSkillParticipantAccessMock
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
  createdByOrganizationActorOid: null
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
    db.consumerGroup.findMany.mockResolvedValue([personalConsumerGroup]);
    transactionDb.consumerAccess.findMany.mockResolvedValue([]);
    db.accessTagEntity.findMany.mockResolvedValue([]);
    db.storeParticipant.findMany.mockResolvedValue([]);
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
    setSkillParticipantAccessRoleMock.mockResolvedValue({
      id: 'skp_1'
    });
  });

  it('shares consumer read access through a participant-scoped personal-group policy', async () => {
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

    expect(createConsumerAccessMock).not.toHaveBeenCalled();
    expect(grantAccessMock).toHaveBeenCalledWith(
      expect.objectContaining({
        permission: 'skill_read',
        subject: { personalConsumerGroupForProfile: targetProfile },
        policyScope: {
          type: 'skill_participant',
          skillParticipantId: 'skp_1'
        }
      })
    );
  });

  it('resolves actors before using a transaction-aware mutation per share target', async () => {
    let secondProfile = {
      ...targetProfile,
      oid: 17n,
      id: 'profile_2',
      personalConsumerGroupOid: 18n
    };
    db.consumerProfile.findMany.mockResolvedValue([targetProfile, secondProfile]);

    await consumerSkillService.shareSkill({
      organization: organization as any,
      instance: instance as any,
      skill: skill as any,
      permission: 'read',
      targets: {
        consumerProfileIds: [targetProfile.id, secondProfile.id]
      }
    });

    expect(withTransactionMock).toHaveBeenCalledTimes(2);
    expect(transactionDb.consumerAccess.findMany).toHaveBeenCalledTimes(2);
    expect(db.consumerAccess.findMany).not.toHaveBeenCalled();
    expect(setSkillParticipantAccessRoleMock).toHaveBeenCalledTimes(2);
    expect(ensureConsumerActorMock).toHaveBeenCalledTimes(2);
    expect(ensureConsumerActorMock.mock.invocationCallOrder[0]).toBeLessThan(
      withTransactionMock.mock.invocationCallOrder[0]!
    );
    expect(grantAccessMock).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: { personalConsumerGroupForProfile: targetProfile }
      })
    );
    expect(grantAccessMock).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: { personalConsumerGroupForProfile: secondProfile }
      })
    );
  });

  it('grants direct consumer write access without creating a participant', async () => {
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
        subject: { personalConsumerGroupForProfile: targetProfile },
        resource: { skill },
        policyScope: {
          type: 'skill_participant',
          skillParticipantId: 'skp_1'
        }
      })
    );
  });

  it('revokes legacy personal ConsumerAccess and participant-scoped policies', async () => {
    let access = { oid: 50n };
    db.consumerProfile.findMany.mockResolvedValue([targetProfile]);
    transactionDb.consumerAccess.findMany.mockResolvedValue([access]);

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
    expect(revokeSkillParticipantAccessMock).toHaveBeenCalledWith({
      organization,
      consumerProfile: targetProfile,
      skill
    });
  });

  it('revokes legacy personal access even when no participant exists', async () => {
    let access = { oid: 50n };
    db.consumerProfile.findMany.mockResolvedValue([targetProfile]);
    transactionDb.consumerAccess.findMany.mockResolvedValue([access]);
    setSkillParticipantAccessRoleMock.mockResolvedValue(undefined);

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
    expect(revokeSkillParticipantAccessMock).toHaveBeenCalledWith({
      organization,
      consumerProfile: targetProfile,
      skill
    });
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

  it('rejects changes to privileged organization-member access', async () => {
    let actor = { oid: 11n, id: 'actor_1' };
    let member = { oid: 12n, id: 'member_1', actor };
    db.organizationMember.findMany.mockResolvedValue([member]);

    await expect(
      consumerSkillService.shareSkill({
        organization: organization as any,
        instance: instance as any,
        skill: skill as any,
        permission: 'write',
        targets: {
          organizationMemberIds: [member.id]
        }
      })
    ).rejects.toThrow('privileged and cannot be changed');
  });

  it('prevents canonical owners from being downgraded', async () => {
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
        accessTags: [61n]
      })
    );
    expect(createSkillMock).not.toHaveBeenCalled();
  });

  it('grants imported skills to the importing consumer profile', async () => {
    let importedProfile = {
      ...targetProfile,
      status: 'active',
      instance,
      surface: {
        ...consumerSurface,
        organization
      }
    };
    db.consumerProfile.findUnique.mockResolvedValue(importedProfile);

    await consumerSkillService.grantImportedSkillAccess({
      consumerProfileOid: targetProfile.oid,
      skill: skill as any
    });

    expect(createConsumerAccessMock).not.toHaveBeenCalled();
    expect(grantAccessMock).toHaveBeenCalledWith(
      expect.objectContaining({
        permission: 'skill_write',
        subject: { personalConsumerGroupForProfile: importedProfile },
        resource: { skill },
        policyScope: {
          type: 'skill_participant',
          skillParticipantId: 'skp_1'
        }
      })
    );
    expect(grantAccessMock).toHaveBeenCalledWith(
      expect.objectContaining({
        permission: 'skill_manage_access',
        subject: { personalConsumerGroupForProfile: importedProfile },
        resource: { skill },
        policyScope: {
          type: 'skill_participant',
          skillParticipantId: 'skp_1'
        }
      })
    );
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
        targets: {
          organizationMemberIds: [member.id]
        }
      })
    ).rejects.toThrow('privileged and cannot be changed');
  });
});
