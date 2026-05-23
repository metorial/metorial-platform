import { preconditionFailedError, ServiceError } from '@mtsrc/error';
import { Service } from '@mtsrc/service';
import {
  ConsumerAccess,
  ConsumerGroup,
  ConsumerProfile,
  ID,
  MagicMcpEndpoint,
  MagicMcpGroup,
  MagicMcpServer,
  MagicMcpToken,
  Organization,
  ProviderTemplate,
  Skill,
  SkillGroup,
  SkillTemplate,
  withTransaction
} from '@metorial/db';
import {
  consumerMagicMcpConnectRoles,
  consumerMagicMcpReadRoles,
  consumerMagicMcpWriteRoles,
  consumerProviderTemplateReadRoles,
  consumerSkillReadRoles,
  consumerSkillWriteRoles
} from '@metorial/module-access';

type ConsumerAccessPermission =
  | 'magic_mcp_read'
  | 'magic_mcp_connect'
  | 'magic_mcp_write'
  | 'provider_template_read'
  | 'skill_read'
  | 'skill_write';

type ConsumerAccessPolicyScope =
  | {
      type: 'consumer_access';
      consumerAccessId: string;
    }
  | undefined;

type ConsumerAccessResource =
  | { magicMcpServer: Pick<MagicMcpServer, 'oid'> }
  | { magicMcpEndpoint: Pick<MagicMcpEndpoint, 'oid'> }
  | { magicMcpToken: Pick<MagicMcpToken, 'oid'> }
  | { magicMcpGroup: Pick<MagicMcpGroup, 'oid'> }
  | { providerTemplate: Pick<ProviderTemplate, 'oid'> }
  | { skill: Pick<Skill, 'oid'> }
  | { skillTemplate: Pick<SkillTemplate, 'oid'> }
  | { skillGroup: Pick<SkillGroup, 'oid'> };

type ConsumerAccessSubject =
  | {
      consumerProfile: Pick<ConsumerProfile, 'accessTagOid'>;
    }
  | {
      consumerGroup: Pick<ConsumerGroup, 'accessTagOid'>;
    }
  | {
      personalConsumerGroupForProfile: Pick<ConsumerProfile, 'personalConsumerGroupOid'>;
    };

let consumerAccessPolicies: Record<
  ConsumerAccessPermission,
  { name: string; systemIdentifier: string; roles: string[] }
> = {
  magic_mcp_read: {
    name: 'Metorial Consumer Magic MCP Read',
    systemIdentifier: 'consumer_magic_mcp_read',
    roles: [...consumerMagicMcpReadRoles]
  },
  magic_mcp_connect: {
    name: 'Metorial Consumer Magic MCP Connect',
    systemIdentifier: 'consumer_magic_mcp_connect',
    roles: [...consumerMagicMcpConnectRoles]
  },
  magic_mcp_write: {
    name: 'Metorial Consumer Magic MCP Write',
    systemIdentifier: 'consumer_magic_mcp_write',
    roles: [...consumerMagicMcpWriteRoles]
  },
  provider_template_read: {
    name: 'Metorial Consumer Provider Template Read',
    systemIdentifier: 'consumer_provider_template_read',
    roles: [...consumerProviderTemplateReadRoles]
  },
  skill_read: {
    name: 'Metorial Consumer Skill Read',
    systemIdentifier: 'consumer_skill_read',
    roles: [...consumerSkillReadRoles]
  },
  skill_write: {
    name: 'Metorial Consumer Skill Write',
    systemIdentifier: 'consumer_skill_write',
    roles: [...consumerSkillWriteRoles]
  }
};

let getPolicyConfig = (d: {
  permission: ConsumerAccessPermission;
  policyScope?: ConsumerAccessPolicyScope;
}) => {
  let base = consumerAccessPolicies[d.permission];
  if (!d.policyScope) {
    return base;
  }

  if (d.policyScope.type == 'consumer_access') {
    return {
      name: `${base.name} (${d.policyScope.consumerAccessId})`,
      systemIdentifier: `consumer_access:${d.policyScope.consumerAccessId}:${d.permission}`,
      roles: base.roles
    };
  }

  return base;
};

let isProviderTemplatePermission = (permission: ConsumerAccessPermission) => {
  return permission == 'provider_template_read';
};

let isSkillPermission = (permission: ConsumerAccessPermission) => {
  return permission == 'skill_read' || permission == 'skill_write';
};

let invalidConsumerAccessTargetError = () =>
  new ServiceError(
    preconditionFailedError({
      message: 'Consumer access target is invalid.'
    })
  );

let getStoredConsumerAccessResource = (
  consumerAccess: Pick<ConsumerAccess, 'type'> & {
    providerTemplate: Pick<ProviderTemplate, 'oid'> | null;
    magicMcpServer: Pick<MagicMcpServer, 'oid'> | null;
    skill?: Pick<Skill, 'oid'> | null;
    skillTemplate?: Pick<SkillTemplate, 'oid'> | null;
    skillGroup?: Pick<SkillGroup, 'oid'> | null;
  }
) => {
  if (consumerAccess.type == 'provider_template') {
    if (
      !consumerAccess.providerTemplate ||
      consumerAccess.magicMcpServer ||
      consumerAccess.skill ||
      consumerAccess.skillTemplate ||
      consumerAccess.skillGroup
    ) {
      throw invalidConsumerAccessTargetError();
    }

    return {
      type: 'provider_template' as const,
      providerTemplate: consumerAccess.providerTemplate
    };
  }

  if (consumerAccess.type == 'skill') {
    if (
      !consumerAccess.skill ||
      consumerAccess.providerTemplate ||
      consumerAccess.magicMcpServer ||
      consumerAccess.skillTemplate ||
      consumerAccess.skillGroup
    ) {
      throw invalidConsumerAccessTargetError();
    }

    return {
      type: 'skill' as const,
      skill: consumerAccess.skill
    };
  }

  if (consumerAccess.type == 'skill_template') {
    if (
      !consumerAccess.skillTemplate ||
      consumerAccess.providerTemplate ||
      consumerAccess.magicMcpServer ||
      consumerAccess.skill ||
      consumerAccess.skillGroup
    ) {
      throw invalidConsumerAccessTargetError();
    }

    return {
      type: 'skill_template' as const,
      skillTemplate: consumerAccess.skillTemplate
    };
  }

  if (consumerAccess.type == 'skill_group') {
    if (
      !consumerAccess.skillGroup ||
      consumerAccess.providerTemplate ||
      consumerAccess.magicMcpServer ||
      consumerAccess.skill ||
      consumerAccess.skillTemplate
    ) {
      throw invalidConsumerAccessTargetError();
    }

    return {
      type: 'skill_group' as const,
      skillGroup: consumerAccess.skillGroup
    };
  }

  if (
    !consumerAccess.magicMcpServer ||
    consumerAccess.providerTemplate ||
    consumerAccess.skill ||
    consumerAccess.skillTemplate ||
    consumerAccess.skillGroup
  ) {
    throw invalidConsumerAccessTargetError();
  }

  return {
    type: 'magic_mcp_server' as const,
    magicMcpServer: consumerAccess.magicMcpServer
  };
};

class ConsumerAccessPolicyServiceImpl {
  private async getOrCreatePolicy(d: {
    organization: Organization;
    permission: ConsumerAccessPermission;
    policyScope?: ConsumerAccessPolicyScope;
  }) {
    let config = getPolicyConfig(d);

    return await withTransaction(async db => {
      return await db.accessTagPolicy.upsert({
        where: {
          organizationOid_systemIdentifier: {
            organizationOid: d.organization.oid,
            systemIdentifier: config.systemIdentifier
          }
        },
        create: {
          id: await ID.generateId('accessTagPolicy'),
          name: config.name,
          systemIdentifier: config.systemIdentifier,
          organizationOid: d.organization.oid,
          roles: config.roles
        },
        update: {
          name: config.name,
          roles: config.roles
        }
      });
    });
  }

  private async getPolicy(d: {
    organization: Organization;
    permission: ConsumerAccessPermission;
    policyScope?: ConsumerAccessPolicyScope;
  }) {
    let config = getPolicyConfig(d);

    return await withTransaction(
      async db => {
        return await db.accessTagPolicy.findFirst({
          where: {
            organizationOid: d.organization.oid,
            systemIdentifier: config.systemIdentifier
          }
        });
      },
      {
        ifExists: true
      }
    );
  }

  private async getSubjectAccessTagOids(d: { subject: ConsumerAccessSubject }) {
    if ('consumerProfile' in d.subject) {
      return [d.subject.consumerProfile.accessTagOid];
    }

    if ('consumerGroup' in d.subject) {
      return [d.subject.consumerGroup.accessTagOid];
    }

    if (!('personalConsumerGroupForProfile' in d.subject)) {
      throw new Error('Unsupported consumer access subject');
    }

    let personalConsumerGroupOid =
      d.subject.personalConsumerGroupForProfile.personalConsumerGroupOid;

    let personalConsumerGroup = await withTransaction(async db => {
      return await db.consumerGroup.findUniqueOrThrow({
        where: {
          oid: personalConsumerGroupOid
        },
        select: {
          accessTagOid: true
        }
      });
    });

    return [personalConsumerGroup.accessTagOid];
  }

  private getResourceData(resource: ConsumerAccessResource) {
    if ('magicMcpServer' in resource) {
      return {
        magicMcpServerOid: resource.magicMcpServer.oid
      };
    }

    if ('magicMcpToken' in resource) {
      return {
        magicMcpTokenOid: resource.magicMcpToken.oid
      };
    }

    if ('magicMcpEndpoint' in resource) {
      return {
        magicMcpEndpointOid: resource.magicMcpEndpoint.oid
      };
    }

    if ('magicMcpGroup' in resource) {
      return {
        magicMcpGroupOid: resource.magicMcpGroup.oid
      };
    }

    if ('skill' in resource) {
      return {
        skillOid: resource.skill.oid
      };
    }

    if ('skillTemplate' in resource) {
      return {
        skillTemplateOid: resource.skillTemplate.oid
      };
    }

    if ('skillGroup' in resource) {
      return {
        skillGroupOid: resource.skillGroup.oid
      };
    }

    return {
      providerTemplateOid: resource.providerTemplate.oid
    };
  }

  private validatePermission(d: {
    permission: ConsumerAccessPermission;
    resource: ConsumerAccessResource;
  }) {
    if (isProviderTemplatePermission(d.permission) && !('providerTemplate' in d.resource)) {
      throw new Error(
        'Provider template permissions can only be attached to provider templates'
      );
    }

    if (
      isSkillPermission(d.permission) &&
      !('skill' in d.resource) &&
      !('skillTemplate' in d.resource) &&
      !('skillGroup' in d.resource)
    ) {
      throw new Error('Skill permissions can only be attached to skill resources');
    }

    if (
      !isProviderTemplatePermission(d.permission) &&
      !isSkillPermission(d.permission) &&
      'providerTemplate' in d.resource
    ) {
      throw new Error('Magic MCP permissions can only be attached to Magic MCP resources');
    }

    if (
      !isSkillPermission(d.permission) &&
      ('skill' in d.resource || 'skillTemplate' in d.resource || 'skillGroup' in d.resource)
    ) {
      throw new Error('Non-skill permissions cannot be attached to skill resources');
    }

    if (d.permission == 'skill_write' && !('skill' in d.resource)) {
      throw new Error('Skill write permissions can only be attached to skills');
    }
  }

  async grantAccess(d: {
    organization: Organization;
    permission: ConsumerAccessPermission;
    subject: ConsumerAccessSubject;
    resource: ConsumerAccessResource;
    policyScope?: ConsumerAccessPolicyScope;
  }) {
    this.validatePermission(d);

    return await withTransaction(async db => {
      let policy = await this.getOrCreatePolicy({
        organization: d.organization,
        permission: d.permission,
        policyScope: d.policyScope
      });
      let accessTagOids = await this.getSubjectAccessTagOids({
        subject: d.subject
      });
      let resourceData = this.getResourceData(d.resource);

      for (let accessTagOid of accessTagOids) {
        let existing = await db.accessTagEntity.findFirst({
          where: {
            accessTagOid,
            accessTagPolicyOid: policy.oid,
            ...resourceData
          }
        });
        if (existing) {
          continue;
        }

        await db.accessTagEntity.create({
          data: {
            accessTagOid,
            accessTagPolicyOid: policy.oid,
            ...resourceData
          }
        });
      }

      return policy;
    });
  }

  async revokeAccess(d: {
    organization: Organization;
    permission: ConsumerAccessPermission;
    subject: ConsumerAccessSubject;
    resource: ConsumerAccessResource;
    policyScope?: ConsumerAccessPolicyScope;
  }) {
    this.validatePermission(d);

    await withTransaction(async db => {
      let policy = await this.getPolicy({
        organization: d.organization,
        permission: d.permission,
        policyScope: d.policyScope
      });
      if (!policy) {
        return;
      }
      let accessTagOids = await this.getSubjectAccessTagOids({
        subject: d.subject
      });
      let resourceData = this.getResourceData(d.resource);

      await db.accessTagEntity.deleteMany({
        where: {
          accessTagOid: {
            in: accessTagOids
          },
          accessTagPolicyOid: policy.oid,
          ...resourceData
        }
      });
    });
  }

  async revokeAccessForConsumerAccess(d: {
    organization: Organization;
    consumerAccess: Pick<ConsumerAccess, 'id' | 'type'> & {
      consumerGroup: Pick<ConsumerGroup, 'accessTagOid'>;
      providerTemplate: Pick<ProviderTemplate, 'oid'> | null;
      magicMcpServer: Pick<MagicMcpServer, 'oid'> | null;
      skill: Pick<Skill, 'oid'> | null;
      skillTemplate?: Pick<SkillTemplate, 'oid'> | null;
      skillGroup?: Pick<SkillGroup, 'oid'> | null;
    };
  }) {
    let resource = getStoredConsumerAccessResource(d.consumerAccess);

    if (resource.type == 'provider_template') {
      await this.revokeAccess({
        organization: d.organization,
        permission: 'provider_template_read',
        subject: {
          consumerGroup: d.consumerAccess.consumerGroup
        },
        resource: {
          providerTemplate: resource.providerTemplate
        },
        policyScope: {
          type: 'consumer_access',
          consumerAccessId: d.consumerAccess.id
        }
      });

      return;
    }

    if (resource.type == 'skill') {
      for (let permission of ['skill_read', 'skill_write'] as const) {
        await this.revokeAccess({
          organization: d.organization,
          permission,
          subject: {
            consumerGroup: d.consumerAccess.consumerGroup
          },
          resource: {
            skill: resource.skill
          },
          policyScope: {
            type: 'consumer_access',
            consumerAccessId: d.consumerAccess.id
          }
        });
      }

      return;
    }

    if (resource.type == 'skill_template') {
      await this.revokeAccess({
        organization: d.organization,
        permission: 'skill_read',
        subject: {
          consumerGroup: d.consumerAccess.consumerGroup
        },
        resource: {
          skillTemplate: resource.skillTemplate
        },
        policyScope: {
          type: 'consumer_access',
          consumerAccessId: d.consumerAccess.id
        }
      });

      return;
    }

    if (resource.type == 'skill_group') {
      await this.revokeAccess({
        organization: d.organization,
        permission: 'skill_read',
        subject: {
          consumerGroup: d.consumerAccess.consumerGroup
        },
        resource: {
          skillGroup: resource.skillGroup
        },
        policyScope: {
          type: 'consumer_access',
          consumerAccessId: d.consumerAccess.id
        }
      });

      return;
    }

    for (let permission of [
      'magic_mcp_read',
      'magic_mcp_connect',
      'magic_mcp_write'
    ] as const) {
      await this.revokeAccess({
        organization: d.organization,
        permission,
        subject: {
          consumerGroup: d.consumerAccess.consumerGroup
        },
        resource: {
          magicMcpServer: resource.magicMcpServer
        },
        policyScope: {
          type: 'consumer_access',
          consumerAccessId: d.consumerAccess.id
        }
      });
    }
  }
}

export let consumerAccessPolicyService = Service.create(
  'consumerAccessPolicyService',
  () => new ConsumerAccessPolicyServiceImpl()
).build();
