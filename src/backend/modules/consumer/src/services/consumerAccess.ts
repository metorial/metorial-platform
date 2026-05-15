import { notFoundError, preconditionFailedError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  ConsumerAccess,
  ConsumerAccessListing,
  ConsumerAccessTargetType,
  ConsumerGroup,
  ConsumerSurface,
  db,
  ID,
  MagicMcpServer,
  Organization,
  ProviderTemplate,
  Skill,
  SkillGroup,
  SkillTemplate,
  withTransaction
} from '@metorial/db';
import { isPreconfiguredMagicMcpServer } from '../lib/magicMcpServerSource';
import { consumerAccessPolicyService } from './accessPolicy';

let include = {
  consumerGroup: true,
  providerTemplate: true,
  magicMcpServer: true,
  skill: true,
  skillTemplate: true,
  skillGroup: true,
  listing: true
} as const;

type ConsumerAccessCreateInput =
  | {
      type: 'provider_template';
      providerTemplate: ProviderTemplate;
    }
  | {
      type: 'magic_mcp_server';
      magicMcpServer: MagicMcpServer;
    }
  | {
      type: 'skill';
      skill: Skill;
    }
  | {
      type: 'skill_template';
      skillTemplate: SkillTemplate;
    }
  | {
      type: 'skill_group';
      skillGroup: SkillGroup;
    };

type ConsumerAccessWithRelations = ConsumerAccess & {
  consumerGroup: ConsumerGroup;
  providerTemplate: ProviderTemplate | null;
  magicMcpServer: MagicMcpServer | null;
  skill: Skill | null;
  skillTemplate: SkillTemplate | null;
  skillGroup: SkillGroup | null;
  listing: ConsumerAccessListing | null;
};

class ConsumerAccessServiceImpl {
  private getDefaultListingValues(
    access: ConsumerAccessCreateInput | ConsumerAccessWithRelations
  ): Pick<ConsumerAccessListing, 'name' | 'description' | 'readme'> {
    if (access.type == 'provider_template') {
      return {
        name: access.providerTemplate!.name,
        description: access.providerTemplate!.description,
        readme: null
      };
    }

    if (access.type == 'skill') {
      return {
        name: access.skill!.name,
        description: null,
        readme: null
      };
    }

    if (access.type == 'skill_template') {
      return {
        name: access.skillTemplate!.name,
        description: access.skillTemplate!.description,
        readme: null
      };
    }

    if (access.type == 'skill_group') {
      return {
        name: access.skillGroup!.name,
        description: access.skillGroup!.description,
        readme: null
      };
    }

    return {
      name: access.magicMcpServer!.name ?? access.magicMcpServer!.id,
      description: access.magicMcpServer!.description,
      readme: null
    };
  }

  private async upsertSharedListing(d: {
    consumerSurface: Pick<ConsumerSurface, 'oid'>;
    access: ConsumerAccessCreateInput | ConsumerAccessWithRelations;
    input: {
      name?: string;
      description?: string | null;
      readme?: string | null;
    };
  }) {
    let defaults = this.getDefaultListingValues(d.access);

    return withTransaction(async db => {
      let listing = await db.consumerAccessListing.upsert({
        where:
          d.access.type == 'provider_template'
            ? {
                surfaceOid_providerTemplateOid: {
                  surfaceOid: d.consumerSurface.oid,
                  providerTemplateOid: d.access.providerTemplate!.oid
                }
              }
            : d.access.type == 'magic_mcp_server'
              ? {
                  surfaceOid_magicMcpServerOid: {
                    surfaceOid: d.consumerSurface.oid,
                    magicMcpServerOid: d.access.magicMcpServer!.oid
                  }
                }
              : d.access.type == 'skill'
                ? {
                    surfaceOid_skillOid: {
                      surfaceOid: d.consumerSurface.oid,
                      skillOid: d.access.skill!.oid
                    }
                  }
                : d.access.type == 'skill_template'
                  ? {
                      surfaceOid_skillTemplateOid: {
                        surfaceOid: d.consumerSurface.oid,
                        skillTemplateOid: d.access.skillTemplate!.oid
                      }
                    }
                  : {
                      surfaceOid_skillGroupOid: {
                        surfaceOid: d.consumerSurface.oid,
                        skillGroupOid: d.access.skillGroup!.oid
                      }
                    },
        create: {
          id: await ID.generateId('consumerAccess'),
          surfaceOid: d.consumerSurface.oid,
          providerTemplateOid:
            d.access.type == 'provider_template' ? d.access.providerTemplate!.oid : undefined,
          magicMcpServerOid:
            d.access.type == 'magic_mcp_server' ? d.access.magicMcpServer!.oid : undefined,
          skillOid: d.access.type == 'skill' ? d.access.skill!.oid : undefined,
          skillTemplateOid:
            d.access.type == 'skill_template' ? d.access.skillTemplate!.oid : undefined,
          skillGroupOid: d.access.type == 'skill_group' ? d.access.skillGroup!.oid : undefined,
          name: d.input.name ?? defaults.name,
          description: d.input.description ?? defaults.description,
          readme: d.input.readme ?? defaults.readme
        },
        update: {
          name: d.input.name,
          description: d.input.description,
          readme: d.input.readme
        }
      });

      await db.consumerAccess.updateMany({
        where:
          d.access.type == 'provider_template'
            ? {
                surfaceOid: d.consumerSurface.oid,
                providerTemplateOid: d.access.providerTemplate!.oid
              }
            : d.access.type == 'magic_mcp_server'
              ? {
                  surfaceOid: d.consumerSurface.oid,
                  magicMcpServerOid: d.access.magicMcpServer!.oid
                }
              : d.access.type == 'skill'
                ? {
                    surfaceOid: d.consumerSurface.oid,
                    skillOid: d.access.skill!.oid
                  }
                : d.access.type == 'skill_template'
                  ? {
                      surfaceOid: d.consumerSurface.oid,
                      skillTemplateOid: d.access.skillTemplate!.oid
                    }
                  : {
                      surfaceOid: d.consumerSurface.oid,
                      skillGroupOid: d.access.skillGroup!.oid
                    },
        data: {
          listingOid: listing.oid
        }
      });

      return listing;
    });
  }

  async listConsumerAccesses(d: {
    consumerSurface: ConsumerSurface;
    consumerGroupIds?: string[];
    providerTemplateIds?: string[];
    magicMcpServerIds?: string[];
    skillIds?: string[];
    skillTemplateIds?: string[];
    skillGroupIds?: string[];
    consumerAccessListingIds?: string[];
    types?: ConsumerAccessTargetType[];
    search?: string;
  }) {
    let search = d.search?.trim();
    let hasConsumerGroupFilter = !!d.consumerGroupIds?.length;
    let hasProviderTemplateFilter = !!d.providerTemplateIds?.length;
    let hasMagicMcpServerFilter = !!d.magicMcpServerIds?.length;
    let hasSkillFilter = !!d.skillIds?.length;
    let hasSkillTemplateFilter = !!d.skillTemplateIds?.length;
    let hasSkillGroupFilter = !!d.skillGroupIds?.length;
    let hasConsumerAccessListingFilter = !!d.consumerAccessListingIds?.length;

    let consumerGroups = hasConsumerGroupFilter
      ? await db.consumerGroup.findMany({
          where: {
            surfaceOid: d.consumerSurface.oid,
            id: {
              in: d.consumerGroupIds
            }
          },
          select: {
            oid: true
          }
        })
      : undefined;
    let providerTemplates = hasProviderTemplateFilter
      ? await db.providerTemplate.findMany({
          where: {
            instanceOid: d.consumerSurface.instanceOid,
            id: {
              in: d.providerTemplateIds
            }
          },
          select: {
            oid: true
          }
        })
      : undefined;
    let magicMcpServers = hasMagicMcpServerFilter
      ? await db.magicMcpServer.findMany({
          where: {
            instanceOid: d.consumerSurface.instanceOid,
            id: {
              in: d.magicMcpServerIds
            }
          },
          select: {
            oid: true
          }
        })
      : undefined;
    let skills = hasSkillFilter
      ? await db.skill.findMany({
          where: {
            instanceOid: d.consumerSurface.instanceOid,
            id: {
              in: d.skillIds
            }
          },
          select: {
            oid: true
          }
        })
      : undefined;
    let skillTemplates = hasSkillTemplateFilter
      ? await db.skillTemplate.findMany({
          where: {
            instanceOid: d.consumerSurface.instanceOid,
            id: {
              in: d.skillTemplateIds
            }
          },
          select: {
            oid: true
          }
        })
      : undefined;
    let skillGroups = hasSkillGroupFilter
      ? await db.skillGroup.findMany({
          where: {
            instanceOid: d.consumerSurface.instanceOid,
            id: {
              in: d.skillGroupIds
            }
          },
          select: {
            oid: true
          }
        })
      : undefined;
    let consumerAccessListings = hasConsumerAccessListingFilter
      ? await db.consumerAccessListing.findMany({
          where: {
            surfaceOid: d.consumerSurface.oid,
            id: {
              in: d.consumerAccessListingIds
            }
          },
          select: {
            oid: true
          }
        })
      : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        return await db.consumerAccess.findMany({
          ...opts,
          where: {
            AND: [
              {
                surfaceOid: d.consumerSurface.oid,
                type: d.types?.length ? { in: d.types } : undefined,
                consumerGroupOid: hasConsumerGroupFilter
                  ? {
                      in: consumerGroups?.map(group => group.oid) ?? []
                    }
                  : undefined,
                providerTemplateOid: hasProviderTemplateFilter
                  ? {
                      in:
                        providerTemplates?.map(providerTemplate => providerTemplate.oid) ?? []
                    }
                  : undefined,
                magicMcpServerOid: hasMagicMcpServerFilter
                  ? {
                      in: magicMcpServers?.map(magicMcpServer => magicMcpServer.oid) ?? []
                    }
                  : undefined,
                skillOid: hasSkillFilter
                  ? {
                      in: skills?.map(skill => skill.oid) ?? []
                    }
                  : undefined,
                skillTemplateOid: hasSkillTemplateFilter
                  ? {
                      in: skillTemplates?.map(skillTemplate => skillTemplate.oid) ?? []
                    }
                  : undefined,
                skillGroupOid: hasSkillGroupFilter
                  ? {
                      in: skillGroups?.map(skillGroup => skillGroup.oid) ?? []
                    }
                  : undefined,
                listingOid: hasConsumerAccessListingFilter
                  ? {
                      in:
                        consumerAccessListings?.map(
                          consumerAccessListing => consumerAccessListing.oid
                        ) ?? []
                    }
                  : undefined
              },
              search
                ? {
                    OR: [
                      {
                        listing: {
                          name: {
                            contains: search,
                            mode: 'insensitive'
                          }
                        }
                      },
                      {
                        providerTemplate: {
                          name: {
                            contains: search,
                            mode: 'insensitive'
                          }
                        }
                      },
                      {
                        magicMcpServer: {
                          name: {
                            contains: search,
                            mode: 'insensitive'
                          }
                        }
                      },
                      {
                        skill: {
                          name: {
                            contains: search,
                            mode: 'insensitive'
                          }
                        }
                      },
                      {
                        skillTemplate: {
                          name: {
                            contains: search,
                            mode: 'insensitive'
                          }
                        }
                      },
                      {
                        skillGroup: {
                          name: {
                            contains: search,
                            mode: 'insensitive'
                          }
                        }
                      }
                    ]
                  }
                : {},
              {
                OR: [
                  {
                    type: 'provider_template',
                    providerTemplate: {
                      status: 'active'
                    }
                  },
                  {
                    type: 'magic_mcp_server',
                    magicMcpServer: {
                      status: 'active'
                    }
                  },
                  {
                    type: 'skill',
                    skill: {
                      status: 'active'
                    }
                  },
                  {
                    type: 'skill_template',
                    skillTemplate: {
                      status: 'active'
                    }
                  },
                  {
                    type: 'skill_group',
                    skillGroup: {
                      status: 'active'
                    }
                  }
                ]
              }
            ]
          },
          include
        });
      })
    );
  }

  async getConsumerAccessById(d: {
    consumerSurface: ConsumerSurface;
    consumerAccessId: string;
  }) {
    let consumerAccess = await db.consumerAccess.findFirst({
      where: {
        surfaceOid: d.consumerSurface.oid,
        id: d.consumerAccessId,
        OR: [
          {
            type: 'provider_template',
            providerTemplate: {
              status: 'active'
            }
          },
          {
            type: 'magic_mcp_server',
            magicMcpServer: {
              status: 'active'
            }
          },
          {
            type: 'skill',
            skill: {
              status: 'active'
            }
          },
          {
            type: 'skill_template',
            skillTemplate: {
              status: 'active'
            }
          },
          {
            type: 'skill_group',
            skillGroup: {
              status: 'active'
            }
          }
        ]
      },
      include
    });
    if (!consumerAccess) {
      throw new ServiceError(notFoundError('consumer.access'));
    }

    return consumerAccess;
  }

  async createConsumerAccess(d: {
    organization: Organization;
    consumerSurface: ConsumerSurface;
    consumerGroup: ConsumerGroup;
    access: ConsumerAccessCreateInput;
    input?: {
      name?: string;
      description?: string | null;
      readme?: string | null;
    };
  }) {
    if (d.consumerGroup.surfaceOid != d.consumerSurface.oid) {
      throw new ServiceError(notFoundError('consumer.group'));
    }

    if (d.consumerGroup.status != 'active') {
      throw new ServiceError(
        preconditionFailedError({
          message: 'Cannot create access for an inactive consumer group.'
        })
      );
    }

    if (
      ('providerTemplate' in d.access &&
        d.access.providerTemplate.instanceOid != d.consumerSurface.instanceOid) ||
      ('magicMcpServer' in d.access &&
        d.access.magicMcpServer.instanceOid != d.consumerSurface.instanceOid) ||
      ('skill' in d.access && d.access.skill.instanceOid != d.consumerSurface.instanceOid) ||
      ('skillTemplate' in d.access &&
        d.access.skillTemplate.instanceOid != d.consumerSurface.instanceOid) ||
      ('skillGroup' in d.access &&
        d.access.skillGroup.instanceOid != d.consumerSurface.instanceOid)
    ) {
      throw new ServiceError(notFoundError('consumer.access.resource'));
    }

    if ('providerTemplate' in d.access && d.access.providerTemplate.status != 'active') {
      throw new ServiceError(
        preconditionFailedError({
          message: 'Cannot create access for an inactive provider template.'
        })
      );
    }

    if ('magicMcpServer' in d.access && d.access.magicMcpServer.status != 'active') {
      throw new ServiceError(
        preconditionFailedError({
          message: 'Cannot create access for an inactive magic MCP server.'
        })
      );
    }

    if ('skill' in d.access && d.access.skill.status != 'active') {
      throw new ServiceError(
        preconditionFailedError({
          message: 'Cannot create access for an inactive skill.'
        })
      );
    }

    if ('skillTemplate' in d.access && d.access.skillTemplate.status != 'active') {
      throw new ServiceError(
        preconditionFailedError({
          message: 'Cannot create access for an inactive skill template.'
        })
      );
    }

    if ('skillGroup' in d.access && d.access.skillGroup.status != 'active') {
      throw new ServiceError(
        preconditionFailedError({
          message: 'Cannot create access for an inactive skill group.'
        })
      );
    }

    if (d.access.type == 'magic_mcp_server') {
      let portal = await db.portal.findFirst({
        where: { surfaceOid: d.consumerSurface.oid },
        select: { oid: true }
      });

      if (
        portal &&
        d.consumerGroup.type != 'user_access' &&
        !isPreconfiguredMagicMcpServer(d.access.magicMcpServer)
      ) {
        throw new ServiceError(notFoundError('consumer.access.resource'));
      }
    }

    return await withTransaction(async db => {
      let consumerAccess = await db.consumerAccess.upsert({
        where:
          d.access.type == 'provider_template'
            ? {
                consumerGroupOid_providerTemplateOid: {
                  consumerGroupOid: d.consumerGroup.oid,
                  providerTemplateOid: d.access.providerTemplate.oid
                }
              }
            : d.access.type == 'magic_mcp_server'
              ? {
                  consumerGroupOid_magicMcpServerOid: {
                    consumerGroupOid: d.consumerGroup.oid,
                    magicMcpServerOid: d.access.magicMcpServer.oid
                  }
                }
              : d.access.type == 'skill'
                ? {
                    consumerGroupOid_skillOid: {
                      consumerGroupOid: d.consumerGroup.oid,
                      skillOid: d.access.skill.oid
                    }
                  }
                : d.access.type == 'skill_template'
                  ? {
                      consumerGroupOid_skillTemplateOid: {
                        consumerGroupOid: d.consumerGroup.oid,
                        skillTemplateOid: d.access.skillTemplate.oid
                      }
                    }
                  : {
                      consumerGroupOid_skillGroupOid: {
                        consumerGroupOid: d.consumerGroup.oid,
                        skillGroupOid: d.access.skillGroup.oid
                      }
                    },
        create: {
          id: await ID.generateId('consumerAccess'),
          type: d.access.type,
          surfaceOid: d.consumerSurface.oid,
          consumerGroupOid: d.consumerGroup.oid,
          providerTemplateOid:
            d.access.type == 'provider_template' ? d.access.providerTemplate.oid : undefined,
          magicMcpServerOid:
            d.access.type == 'magic_mcp_server' ? d.access.magicMcpServer.oid : undefined,
          skillOid: d.access.type == 'skill' ? d.access.skill.oid : undefined,
          skillTemplateOid:
            d.access.type == 'skill_template' ? d.access.skillTemplate.oid : undefined,
          skillGroupOid: d.access.type == 'skill_group' ? d.access.skillGroup.oid : undefined
        },
        update: {},
        include
      });

      if (d.access.type == 'provider_template') {
        await consumerAccessPolicyService.grantAccess({
          organization: d.organization,
          permission: 'provider_template_read',
          subject: {
            consumerGroup: d.consumerGroup
          },
          resource: {
            providerTemplate: d.access.providerTemplate
          },
          policyScope: {
            type: 'consumer_access',
            consumerAccessId: consumerAccess.id
          }
        });
      } else if (d.access.type == 'magic_mcp_server') {
        for (let permission of ['magic_mcp_read', 'magic_mcp_connect'] as const) {
          await consumerAccessPolicyService.grantAccess({
            organization: d.organization,
            permission,
            subject: {
              consumerGroup: d.consumerGroup
            },
            resource: {
              magicMcpServer: d.access.magicMcpServer
            },
            policyScope: {
              type: 'consumer_access',
              consumerAccessId: consumerAccess.id
            }
          });
        }
      } else if (d.access.type == 'skill') {
        await consumerAccessPolicyService.grantAccess({
          organization: d.organization,
          permission: 'skill_read',
          subject: {
            consumerGroup: d.consumerGroup
          },
          resource: {
            skill: d.access.skill
          },
          policyScope: {
            type: 'consumer_access',
            consumerAccessId: consumerAccess.id
          }
        });
      } else if (d.access.type == 'skill_template') {
        await consumerAccessPolicyService.grantAccess({
          organization: d.organization,
          permission: 'skill_read',
          subject: {
            consumerGroup: d.consumerGroup
          },
          resource: {
            skillTemplate: d.access.skillTemplate
          },
          policyScope: {
            type: 'consumer_access',
            consumerAccessId: consumerAccess.id
          }
        });
      } else {
        await consumerAccessPolicyService.grantAccess({
          organization: d.organization,
          permission: 'skill_read',
          subject: {
            consumerGroup: d.consumerGroup
          },
          resource: {
            skillGroup: d.access.skillGroup
          },
          policyScope: {
            type: 'consumer_access',
            consumerAccessId: consumerAccess.id
          }
        });
      }

      await this.upsertSharedListing({
        consumerSurface: d.consumerSurface,
        access: d.access,
        input: d.input ?? {}
      });

      return (await db.consumerAccess.findUnique({
        where: {
          oid: consumerAccess.oid
        },
        include
      }))!;
    });
  }

  async updateConsumerAccess(d: {
    consumerAccess: ConsumerAccessWithRelations;
    input: {
      name?: string;
      description?: string | null;
      readme?: string | null;
    };
  }) {
    return await withTransaction(async db => {
      await this.upsertSharedListing({
        consumerSurface: {
          oid: d.consumerAccess.surfaceOid
        },
        access: d.consumerAccess,
        input: d.input
      });

      return (await db.consumerAccess.findUnique({
        where: {
          oid: d.consumerAccess.oid
        },
        include
      }))!;
    });
  }

  async deleteConsumerAccess(d: {
    organization: Organization;
    consumerAccess: ConsumerAccessWithRelations;
  }) {
    return await withTransaction(async tx => {
      let consumerAccess = await tx.consumerAccess.delete({
        where: {
          oid: d.consumerAccess.oid
        },
        include
      });

      await consumerAccessPolicyService.revokeAccessForConsumerAccess({
        organization: d.organization,
        consumerAccess
      });

      return consumerAccess;
    });
  }
}

export let consumerAccessService = Service.create(
  'consumerAccessService',
  () => new ConsumerAccessServiceImpl()
).build();
