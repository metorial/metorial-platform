import { beforeEach, describe, expect, it, vi } from 'vitest';

let {
  db,
  transactionDb,
  createConsumerAccessMock,
  deleteConsumerAccessMock,
  grantAccessMock,
  revokeSkillShareAccessMock,
  ensureConsumerActorMock,
  ensureOrganizationActorMock,
  getSkillByIdMock,
  setAccessRoleMock,
  getActorAccessRoleMock,
  fireMock,
  getSkillTemplateByIdMock,
  createSkillMock,
  hasOrganizationMemberSkillAccessMock,
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
    storeParticipantActor: {
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
  revokeSkillShareAccessMock: vi.fn(),
  ensureConsumerActorMock: vi.fn(),
  ensureOrganizationActorMock: vi.fn(),
  getSkillByIdMock: vi.fn(),
  setAccessRoleMock: vi.fn(),
  getActorAccessRoleMock: vi.fn(),
  fireMock: vi.fn(),
  getSkillTemplateByIdMock: vi.fn(),
  createSkillMock: vi.fn(),
  hasOrganizationMemberSkillAccessMock: vi.fn(),
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
  skillService: {
    createSkill: createSkillMock,
    getSkillById: getSkillByIdMock
  }
}));

vi.mock('@metorial/module-store', () => ({
  storeParticipantService: {
    setAccessRole: setAccessRoleMock,
    getActorAccessRole: getActorAccessRoleMock
  }
}));

vi.mock('@metorial/fabric', () => ({
  Fabric: {
    fire: fireMock
  }
}));

vi.mock('@metorial/module-skill-templates', () => ({
  skillTemplateService: {
    getSkillTemplateById: getSkillTemplateByIdMock
  }
}));

vi.mock('@metorial/module-access', () => ({
  skillStoreResourceKind: { kind: 'skill' },
  getStoreResourceKindAccessWhere: vi.fn(async () => ({})),
  hasOrganizationMemberSkillAccess: hasOrganizationMemberSkillAccessMock,
  createResourceAuthorization: ({ resourceActor, accessTags }: any) => ({
    type: 'restricted',
    resourceActor,
    accessTags
  })
}));

vi.mock('@metorial/module-resource-actor', () => ({
  resourceActorService: {
    ensureConsumerActor: ensureConsumerActorMock,
    ensureConsumerProfileActor: ensureConsumerActorMock,
    ensureOrganizationActor: ensureOrganizationActorMock
  }
}));

vi.mock('@metorial/module-consumer-access', () => ({
  consumerAccessService: {
    createConsumerAccess: createConsumerAccessMock,
    deleteConsumerAccess: deleteConsumerAccessMock
  },
  consumerAccessPolicyService: {
    grantAccess: grantAccessMock,
    revokeSkillShareAccessForPersonalGroup: revokeSkillShareAccessMock
  }
}));

import { consumerSkillService } from '../src/services/consumerSkill';

let organization = { oid: 1n };
let instance = { oid: 2n, id: 'ins_1' };
let skill = {
  oid: 3n,
  id: 'skill_1',
  storeOid: 40n,
  instanceOid: instance.oid,
  createdByResourceActorOid: null,
  createdByOrganizationActorOid: null
};
let auditScope = {
  organizationOid: 1n,
  instanceOid: 2n,
  actor: { type: 'consumer_profile', id: 'cpf_1' },
  context: { ip: '127.0.0.1' }
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

let callerProfile = {
  ...targetProfile,
  oid: 70n,
  id: 'profile_caller',
  personalConsumerGroupOid: 71n,
  surfaceOid: consumerSurface.oid,
  ssoGroupIds: []
};

describe('consumer skill sharing', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    db.consumerGroup.findUniqueOrThrow.mockResolvedValue(personalConsumerGroup);
    db.consumerGroup.findMany.mockResolvedValue([personalConsumerGroup]);
    transactionDb.consumerAccess.findMany.mockResolvedValue([]);
    db.accessTagEntity.findMany.mockResolvedValue([]);
    db.storeParticipantActor.findMany.mockResolvedValue([]);
    getActorAccessRoleMock.mockResolvedValue(null);
    hasOrganizationMemberSkillAccessMock.mockResolvedValue(false);
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

  it('shares consumer read access through a share-scoped personal-group policy', async () => {
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
        policyScope: { type: 'skill_share' }
      })
    );
    expect(setAccessRoleMock).toHaveBeenCalledWith({
      store: { oid: 40n },
      actor: { oid: 30n, id: 'resource_actor_consumer' },
      role: 'viewer'
    });
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

    expect(withTransactionMock).toHaveBeenCalledTimes(3);
    expect(transactionDb.consumerAccess.findMany).toHaveBeenCalledTimes(2);
    expect(db.consumerAccess.findMany).not.toHaveBeenCalled();
    expect(setAccessRoleMock).toHaveBeenCalledTimes(2);
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

  it('grants direct consumer write access and makes the consumer a store editor', async () => {
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
        policyScope: { type: 'skill_share' }
      })
    );
    expect(setAccessRoleMock).toHaveBeenCalledWith(
      expect.objectContaining({ store: { oid: 40n }, role: 'editor' })
    );
  });

  it('revokes legacy personal ConsumerAccess and share-scoped policies', async () => {
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
    expect(revokeSkillShareAccessMock).toHaveBeenCalledWith({
      organization,
      consumerProfile: targetProfile,
      skill
    });
    expect(setAccessRoleMock).toHaveBeenCalledWith(
      expect.objectContaining({ store: { oid: 40n }, role: null })
    );
    expect(grantAccessMock).not.toHaveBeenCalled();
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

  describe('organization-member consumers', () => {
    let share = (permission: 'read' | 'write' | 'owner' | 'none') =>
      consumerSkillService.shareSkill({
        organization: organization as any,
        instance: instance as any,
        auditScope: auditScope as any,
        skill: skill as any,
        permission,
        targets: { consumerProfileIds: [targetProfile.id] }
      });

    beforeEach(() => {
      db.consumerProfile.findMany.mockResolvedValue([targetProfile]);
      hasOrganizationMemberSkillAccessMock.mockResolvedValue(true);
    });

    it('allows view-only grants that make a skill show up in their portal', async () => {
      await share('read');
      await share('none');

      expect(grantAccessMock).toHaveBeenCalledWith(
        expect.objectContaining({ permission: 'skill_read' })
      );
      expect(revokeSkillShareAccessMock).toHaveBeenCalled();
    });

    it('rejects raising their access above view', async () => {
      await expect(share('write')).rejects.toThrow('can only be given view access');
      await expect(share('owner')).rejects.toThrow('can only be given view access');

      expect(grantAccessMock).not.toHaveBeenCalled();
    });

    it('does not restrict profiles whose organization-member access is off', async () => {
      hasOrganizationMemberSkillAccessMock.mockResolvedValue(false);

      await share('write');

      expect(grantAccessMock).toHaveBeenCalledWith(
        expect.objectContaining({ permission: 'skill_write' })
      );
    });
  });

  it('makes owners store owners with manage access and audits the change', async () => {
    db.consumerProfile.findMany.mockResolvedValue([targetProfile]);
    getActorAccessRoleMock.mockResolvedValue('editor');

    await consumerSkillService.shareSkill({
      organization: organization as any,
      instance: instance as any,
      auditScope: auditScope as any,
      skill: skill as any,
      permission: 'owner',
      targets: {
        consumerProfileIds: [targetProfile.id]
      }
    });

    expect(setAccessRoleMock).toHaveBeenCalledWith(
      expect.objectContaining({ store: { oid: 40n }, role: 'owner' })
    );
    expect(grantAccessMock).toHaveBeenCalledWith(
      expect.objectContaining({
        permission: 'skill_write',
        policyScope: { type: 'skill_share' }
      })
    );
    expect(grantAccessMock).toHaveBeenCalledWith(
      expect.objectContaining({
        permission: 'skill_manage_access',
        policyScope: { type: 'skill_share' }
      })
    );
    expect(fireMock).toHaveBeenCalledWith('skill.audit.shared:after', {
      auditScope,
      skill,
      shares: [
        {
          consumerProfileId: targetProfile.id,
          permission: 'owner',
          previousPermission: 'write'
        }
      ]
    });
  });

  it('re-applies unchanged shares without recording an audit event', async () => {
    db.consumerProfile.findMany.mockResolvedValue([targetProfile]);
    getActorAccessRoleMock.mockResolvedValue('editor');

    await consumerSkillService.shareSkill({
      organization: organization as any,
      instance: instance as any,
      auditScope: auditScope as any,
      skill: skill as any,
      permission: 'write',
      targets: {
        consumerProfileIds: [targetProfile.id]
      }
    });

    expect(setAccessRoleMock).toHaveBeenCalledWith(
      expect.objectContaining({ store: { oid: 40n }, role: 'editor' })
    );
    expect(fireMock).not.toHaveBeenCalled();
  });

  it('lets admins downgrade owners', async () => {
    db.consumerProfile.findMany.mockResolvedValue([targetProfile]);
    getActorAccessRoleMock.mockResolvedValue('owner');

    await consumerSkillService.shareSkill({
      organization: organization as any,
      instance: instance as any,
      auditScope: auditScope as any,
      skill: skill as any,
      permission: 'read',
      targets: {
        consumerProfileIds: [targetProfile.id]
      }
    });

    expect(revokeSkillShareAccessMock).toHaveBeenCalled();
    expect(setAccessRoleMock).toHaveBeenCalledWith(
      expect.objectContaining({ store: { oid: 40n }, role: 'viewer' })
    );
  });

  it('prevents consumers from downgrading owners', async () => {
    db.skill.findFirst.mockResolvedValue({ oid: skill.oid });
    db.consumerProfile.findMany.mockResolvedValue([targetProfile]);
    getActorAccessRoleMock.mockResolvedValue('owner');

    await expect(
      consumerSkillService.shareSkill({
        organization: organization as any,
        instance: instance as any,
        auditScope: auditScope as any,
        skill: skill as any,
        permission: 'write',
        consumerProfile: callerProfile as any,
        consumerGroups: [],
        targets: {
          consumerProfileIds: [targetProfile.id]
        }
      })
    ).rejects.toThrow('Only admins can remove or downgrade the owners of a skill.');

    expect(setAccessRoleMock).not.toHaveBeenCalled();
  });

  it('only lets owners add other owners', async () => {
    db.skill.findFirst.mockResolvedValue({ oid: skill.oid });
    db.consumerProfile.findMany.mockResolvedValue([targetProfile]);
    getActorAccessRoleMock.mockResolvedValue('editor');

    let share = () =>
      consumerSkillService.shareSkill({
        organization: organization as any,
        instance: instance as any,
        auditScope: auditScope as any,
        skill: skill as any,
        permission: 'owner',
        consumerProfile: callerProfile as any,
        consumerGroups: [],
        targets: {
          consumerProfileIds: [targetProfile.id]
        }
      });

    await expect(share()).rejects.toThrow('Only owners of this skill can add other owners.');
    expect(setAccessRoleMock).not.toHaveBeenCalled();

    getActorAccessRoleMock.mockResolvedValueOnce('owner').mockResolvedValueOnce('viewer');
    await share();

    expect(setAccessRoleMock).toHaveBeenCalledWith(
      expect.objectContaining({ store: { oid: 40n }, role: 'owner' })
    );
  });

  it('checks explicit templates against the consumer access tags', async () => {
    getSkillTemplateByIdMock.mockRejectedValue(new Error('Template not found'));

    await expect(
      consumerSkillService.createConsumerSkill({
        organization: organization as any,
        instance: instance as any,
        project: { oid: 2n } as any,
        auditScope: {
          organizationOid: 1n,
          instanceOid: 2n,
          actor: { type: 'consumer_profile', id: 'cpf_1' },
          context: { ip: '127.0.0.1' }
        } as any,
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

  it('makes the importing consumer profile an owner of imported skills', async () => {
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

    await consumerSkillService.grantConsumerSkillOwnership({
      consumerProfileOid: targetProfile.oid,
      skill: skill as any
    });

    expect(createConsumerAccessMock).not.toHaveBeenCalled();
    expect(setAccessRoleMock).toHaveBeenCalledWith(
      expect.objectContaining({ store: { oid: 40n }, role: 'owner' })
    );
    expect(grantAccessMock).toHaveBeenCalledWith(
      expect.objectContaining({
        permission: 'skill_write',
        subject: { personalConsumerGroupForProfile: importedProfile },
        resource: { skill },
        policyScope: { type: 'skill_share' }
      })
    );
    expect(grantAccessMock).toHaveBeenCalledWith(
      expect.objectContaining({
        permission: 'skill_manage_access',
        subject: { personalConsumerGroupForProfile: importedProfile },
        resource: { skill },
        policyScope: { type: 'skill_share' }
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
