import { preconditionFailedError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
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
  SkillMarketplace,
  SkillPlugin,
  SkillTemplate,
  withTransaction
} from '@metorial/db';
import {
  consumerMagicMcpConnectRoles,
  consumerMagicMcpReadRoles,
  consumerMagicMcpWriteRoles,
  consumerProviderTemplateReadRoles,
  consumerSkillManageAccessRoles,
  consumerSkillMarketplaceWriteRoles,
  consumerSkillPluginWriteRoles,
  consumerSkillReadRoles,
  consumerSkillWriteRoles
} from '@metorial/module-access';

type ConsumerAccessPermission =
  | 'magic_mcp_read'
  | 'magic_mcp_connect'
  | 'magic_mcp_write'
  | 'provider_template_read'
  | 'skill_read'
  | 'skill_write'
  | 'skill_manage_access'
  | 'skill_marketplace_write'
  | 'skill_plugin_write';

type ConsumerAccessPolicyScope =
  | {
      type: 'consumer_access';
      consumerAccessId: string;
    }
  | {
      type: 'skill_participant';
      skillParticipantId: string;
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
  | { skillGroup: Pick<SkillGroup, 'oid'> }
  | { skillMarketplace: Pick<SkillMarketplace, 'oid'> }
  | { skillPlugin: Pick<SkillPlugin, 'oid'> };

type ConsumerAccessSubject =
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
  },
  skill_manage_access: {
    name: 'Metorial Consumer Skill Manage Access',
    systemIdentifier: 'consumer_skill_manage_access',
    roles: [...consumerSkillManageAccessRoles]
  },
  skill_marketplace_write: {
    name: 'Metorial Consumer Skill Marketplace Write',
    systemIdentifier: 'consumer_skill_marketplace_write',
    roles: [...consumerSkillMarketplaceWriteRoles]
  },
  skill_plugin_write: {
    name: 'Metorial Consumer Skill Plugin Write',
    systemIdentifier: 'consumer_skill_plugin_write',
    roles: [...consumerSkillPluginWriteRoles]
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

  return {
    name: `${base.name} (${d.policyScope.skillParticipantId})`,
    systemIdentifier: `skill_participant:${d.policyScope.skillParticipantId}:${d.permission}`,
    roles: base.roles
  };
};

let isProviderTemplatePermission = (permission: ConsumerAccessPermission) => {
  return permission == 'provider_template_read';
};

let isSkillPermission = (permission: ConsumerAccessPermission) =>
  permission == 'skill_read' ||
  permission == 'skill_write' ||
  permission == 'skill_manage_access';

let isSkillMarketplaceWritePermission = (permission: ConsumerAccessPermission) =>
  permission == 'skill_marketplace_write';

let isSkillPluginWritePermission = (permission: ConsumerAccessPermission) =>
  permission == 'skill_plugin_write';

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
    skillMarketplace?: Pick<SkillMarketplace, 'oid'> | null;
    skillPlugin?: Pick<SkillPlugin, 'oid'> | null;
  }
) => {
  if (consumerAccess.type == 'provider_template') {
    if (
      !consumerAccess.providerTemplate ||
      consumerAccess.magicMcpServer ||
      consumerAccess.skill ||
      consumerAccess.skillTemplate ||
      consumerAccess.skillGroup ||
      consumerAccess.skillMarketplace ||
      consumerAccess.skillPlugin
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
      consumerAccess.skillGroup ||
      consumerAccess.skillMarketplace ||
      consumerAccess.skillPlugin
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
      consumerAccess.skillGroup ||
      consumerAccess.skillMarketplace ||
      consumerAccess.skillPlugin
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
      consumerAccess.skillTemplate ||
      consumerAccess.skillMarketplace ||
      consumerAccess.skillPlugin
    ) {
      throw invalidConsumerAccessTargetError();
    }

    return {
      type: 'skill_group' as const,
      skillGroup: consumerAccess.skillGroup
    };
  }

  if (consumerAccess.type == 'skill_marketplace') {
    if (
      !consumerAccess.skillMarketplace ||
      consumerAccess.providerTemplate ||
      consumerAccess.magicMcpServer ||
      consumerAccess.skill ||
      consumerAccess.skillTemplate ||
      consumerAccess.skillGroup ||
      consumerAccess.skillPlugin
    ) {
      throw invalidConsumerAccessTargetError();
    }

    return {
      type: 'skill_marketplace' as const,
      skillMarketplace: consumerAccess.skillMarketplace
    };
  }

  if (consumerAccess.type == 'skill_plugin') {
    if (
      !consumerAccess.skillPlugin ||
      consumerAccess.providerTemplate ||
      consumerAccess.magicMcpServer ||
      consumerAccess.skill ||
      consumerAccess.skillTemplate ||
      consumerAccess.skillGroup ||
      consumerAccess.skillMarketplace
    ) {
      throw invalidConsumerAccessTargetError();
    }

    return {
      type: 'skill_plugin' as const,
      skillPlugin: consumerAccess.skillPlugin
    };
  }

  if (
    !consumerAccess.magicMcpServer ||
    consumerAccess.providerTemplate ||
    consumerAccess.skill ||
    consumerAccess.skillTemplate ||
    consumerAccess.skillGroup ||
    consumerAccess.skillMarketplace ||
    consumerAccess.skillPlugin
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

    if ('skillMarketplace' in resource) {
      return {
        skillMarketplaceOid: resource.skillMarketplace.oid
      };
    }

    if ('skillPlugin' in resource) {
      return {
        skillPluginOid: resource.skillPlugin.oid
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

    if (isSkillMarketplaceWritePermission(d.permission) && !('skillMarketplace' in d.resource)) {
      throw new Error(
        'Skill marketplace write permissions can only be attached to skill marketplaces'
      );
    }

    if (isSkillPluginWritePermission(d.permission) && !('skillPlugin' in d.resource)) {
      throw new Error('Skill plugin write permissions can only be attached to skill plugins');
    }

    if (
      isSkillPermission(d.permission) &&
      !('skill' in d.resource) &&
      !('skillTemplate' in d.resource) &&
      !('skillGroup' in d.resource) &&
      !('skillMarketplace' in d.resource)
    ) {
      throw new Error('Skill permissions can only be attached to skill resources');
    }

    if (
      !isProviderTemplatePermission(d.permission) &&
      !isSkillPermission(d.permission) &&
      !isSkillMarketplaceWritePermission(d.permission) &&
      !isSkillPluginWritePermission(d.permission) &&
      'providerTemplate' in d.resource
    ) {
      throw new Error('Magic MCP permissions can only be attached to Magic MCP resources');
    }

    if (
      !isSkillPermission(d.permission) &&
      !isSkillMarketplaceWritePermission(d.permission) &&
      ('skill' in d.resource || 'skillTemplate' in d.resource || 'skillGroup' in d.resource)
    ) {
      throw new Error('Non-skill permissions cannot be attached to skill resources');
    }

    if (
      (d.permission == 'skill_write' || d.permission == 'skill_manage_access') &&
      !('skill' in d.resource)
    ) {
      throw new Error(
        'Skill write and access-management permissions can only be attached to skills'
      );
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

  async revokeAccessByPolicyScope(d: {
    organization: Organization;
    permission: ConsumerAccessPermission;
    subject: ConsumerAccessSubject;
    policyScope: Exclude<ConsumerAccessPolicyScope, undefined>;
  }) {
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

      await db.accessTagEntity.deleteMany({
        where: {
          accessTagOid: {
            in: accessTagOids
          },
          accessTagPolicyOid: policy.oid
        }
      });
    });
  }

  async revokeSkillParticipantAccessForPersonalGroup(d: {
    organization: Organization;
    consumerProfile: Pick<ConsumerProfile, 'personalConsumerGroupOid'>;
    skill: Pick<Skill, 'oid'>;
  }) {
    let accessTagOids = await this.getSubjectAccessTagOids({
      subject: {
        personalConsumerGroupForProfile: d.consumerProfile
      }
    });

    await withTransaction(async db => {
      await db.accessTagEntity.deleteMany({
        where: {
          accessTagOid: {
            in: accessTagOids
          },
          skillOid: d.skill.oid,
          accessTagPolicy: {
            organizationOid: d.organization.oid,
            OR: [
              {
                systemIdentifier: {
                  startsWith: 'skill_participant:'
                }
              },
              {
                systemIdentifier: {
                  startsWith: 'skill_participant_migration:'
                }
              }
            ]
          }
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
      skillMarketplace?: Pick<SkillMarketplace, 'oid'> | null;
      skillPlugin?: Pick<SkillPlugin, 'oid'> | null;
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
      for (let permission of ['skill_read', 'skill_write', 'skill_manage_access'] as const) {
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

    if (resource.type == 'skill_marketplace') {
      for (let permission of ['skill_read', 'skill_marketplace_write'] as const) {
        await this.revokeAccess({
          organization: d.organization,
          permission,
          subject: {
            consumerGroup: d.consumerAccess.consumerGroup
          },
          resource: {
            skillMarketplace: resource.skillMarketplace
          },
          policyScope: {
            type: 'consumer_access',
            consumerAccessId: d.consumerAccess.id
          }
        });
      }

      return;
    }

    if (resource.type == 'skill_plugin') {
      await this.revokeAccess({
        organization: d.organization,
        permission: 'skill_plugin_write',
        subject: {
          consumerGroup: d.consumerAccess.consumerGroup
        },
        resource: {
          skillPlugin: resource.skillPlugin
        },
        policyScope: {
          type: 'consumer_access',
          consumerAccessId: d.consumerAccess.id
        }
      });

      await this.revokeAccessByPolicyScope({
        organization: d.organization,
        permission: 'skill_read',
        subject: {
          consumerGroup: d.consumerAccess.consumerGroup
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
