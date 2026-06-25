import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  ConsumerAccessListing,
  ConsumerAccessTargetType,
  ConsumerSurface,
  ConsumerSurfaceProviderGroup,
  db,
  ID,
  MagicMcpServer,
  Organization,
  Prisma,
  ProviderTemplate,
  Skill,
  SkillGroup,
  SkillMarketplace,
  SkillTemplate,
  withTransaction
} from '@metorial/db';
import { searchMagicMcpServerIds, searchProviderTemplateIds } from '@metorial/module-search';
import { consumerAccessService } from './consumerAccess';

let include = {
  providerTemplate: true,
  magicMcpServer: true,
  skill: true,
  skillTemplate: true,
  skillGroup: true,
  skillMarketplace: true,
  consumerSurfaceProviderGroups: {
    include: {
      consumerSurfaceProviderGroup: true
    }
  }
} as const;

export type ConsumerAccessListingWithRelations = ConsumerAccessListing & {
  providerTemplate: ProviderTemplate | null;
  magicMcpServer: MagicMcpServer | null;
  skill: Skill | null;
  skillTemplate: SkillTemplate | null;
  skillGroup: SkillGroup | null;
  skillMarketplace: SkillMarketplace | null;
  consumerSurfaceProviderGroups: {
    consumerSurfaceProviderGroup: ConsumerSurfaceProviderGroup;
  }[];
};

type ConsumerAccessListingSearchMatches = {
  providerTemplateIds?: string[];
  magicMcpServerIds?: string[];
};

type ConsumerAccessListingTargetInput =
  | {
      type: 'provider_template';
      providerTemplateId: string;
    }
  | {
      type: 'magic_mcp_server';
      magicMcpServerId: string;
    }
  | {
      type: 'skill';
      skillId: string;
    }
  | {
      type: 'skill_template';
      skillTemplateId: string;
    }
  | {
      type: 'skill_group';
      skillGroupId: string;
    }
  | {
      type: 'skill_marketplace';
      skillMarketplaceId: string;
    };

type ConsumerAccessListingTarget =
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
    }
  | {
      type: 'skill_marketplace';
      skillMarketplace: SkillMarketplace;
    };

class ConsumerAccessListingServiceImpl {
  private async getTarget(d: {
    consumerSurface: ConsumerSurface;
    access: ConsumerAccessListingTargetInput;
  }): Promise<ConsumerAccessListingTarget> {
    if (d.access.type == 'provider_template') {
      let providerTemplate = await db.providerTemplate.findFirst({
        where: {
          instanceOid: d.consumerSurface.instanceOid,
          id: d.access.providerTemplateId,
          status: 'active'
        }
      });
      if (!providerTemplate) throw new ServiceError(notFoundError('provider.template'));
      return { type: 'provider_template', providerTemplate };
    }

    if (d.access.type == 'magic_mcp_server') {
      let magicMcpServer = await db.magicMcpServer.findFirst({
        where: {
          instanceOid: d.consumerSurface.instanceOid,
          id: d.access.magicMcpServerId,
          status: 'active'
        }
      });
      if (!magicMcpServer) throw new ServiceError(notFoundError('magic_mcp.server'));
      return { type: 'magic_mcp_server', magicMcpServer };
    }

    if (d.access.type == 'skill') {
      let skill = await db.skill.findFirst({
        where: {
          instanceOid: d.consumerSurface.instanceOid,
          id: d.access.skillId,
          status: 'active'
        }
      });
      if (!skill) throw new ServiceError(notFoundError('skill'));
      return { type: 'skill', skill };
    }

    if (d.access.type == 'skill_template') {
      let skillTemplate = await db.skillTemplate.findFirst({
        where: {
          instanceOid: d.consumerSurface.instanceOid,
          id: d.access.skillTemplateId,
          status: 'active'
        }
      });
      if (!skillTemplate) throw new ServiceError(notFoundError('skill.template'));
      return { type: 'skill_template', skillTemplate };
    }

    if (d.access.type == 'skill_marketplace') {
      let skillMarketplace = await db.skillMarketplace.findFirst({
        where: {
          instanceOid: d.consumerSurface.instanceOid,
          id: d.access.skillMarketplaceId,
          status: 'active'
        }
      });
      if (!skillMarketplace) throw new ServiceError(notFoundError('skill.marketplace'));
      return { type: 'skill_marketplace', skillMarketplace };
    }

    let skillGroup = await db.skillGroup.findFirst({
      where: {
        instanceOid: d.consumerSurface.instanceOid,
        id: d.access.skillGroupId,
        status: 'active'
      }
    });
    if (!skillGroup) throw new ServiceError(notFoundError('skill.group'));
    return { type: 'skill_group', skillGroup };
  }

  private getTargetDefaultValues(
    target: ConsumerAccessListingTarget
  ): Pick<ConsumerAccessListing, 'name' | 'description' | 'readme'> {
    if (target.type == 'provider_template') {
      return {
        name: target.providerTemplate.name,
        description: target.providerTemplate.description,
        readme: null
      };
    }

    if (target.type == 'magic_mcp_server') {
      return {
        name: target.magicMcpServer.name ?? target.magicMcpServer.id,
        description: target.magicMcpServer.description,
        readme: null
      };
    }

    if (target.type == 'skill') {
      return {
        name: target.skill.name,
        description: null,
        readme: null
      };
    }

    if (target.type == 'skill_template') {
      return {
        name: target.skillTemplate.name,
        description: target.skillTemplate.description,
        readme: null
      };
    }

    if (target.type == 'skill_marketplace') {
      return {
        name: target.skillMarketplace.id,
        description: null,
        readme: null
      };
    }

    return {
      name: target.skillGroup.name,
      description: target.skillGroup.description,
      readme: null
    };
  }

  async list(d: {
    consumerSurface: ConsumerSurface;
    consumerSurfaceProviderGroupIds?: string[];
    providerTemplateIds?: string[];
    magicMcpServerIds?: string[];
    skillIds?: string[];
    skillTemplateIds?: string[];
    skillGroupIds?: string[];
    skillMarketplaceIds?: string[];
    types?: ConsumerAccessTargetType[];
    search?: string;
  }) {
    let hasGroupFilter = !!d.consumerSurfaceProviderGroupIds?.length;
    let hasProviderTemplateFilter = !!d.providerTemplateIds?.length;
    let hasMagicMcpServerFilter = !!d.magicMcpServerIds?.length;
    let hasSkillFilter = !!d.skillIds?.length;
    let hasSkillTemplateFilter = !!d.skillTemplateIds?.length;
    let hasSkillGroupFilter = !!d.skillGroupIds?.length;
    let hasSkillMarketplaceFilter = !!d.skillMarketplaceIds?.length;

    let [
      groups,
      providerTemplates,
      magicMcpServers,
      skills,
      skillTemplates,
      skillGroups,
      skillMarketplaces
    ] = await Promise.all([
      hasGroupFilter
        ? db.consumerSurfaceProviderGroup.findMany({
            where: {
              consumerSurfaceOid: d.consumerSurface.oid,
              id: { in: d.consumerSurfaceProviderGroupIds }
            },
            select: { oid: true }
          })
        : undefined,
      hasProviderTemplateFilter
        ? db.providerTemplate.findMany({
            where: {
              instanceOid: d.consumerSurface.instanceOid,
              id: { in: d.providerTemplateIds }
            },
            select: { oid: true }
          })
        : undefined,
      hasMagicMcpServerFilter
        ? db.magicMcpServer.findMany({
            where: {
              instanceOid: d.consumerSurface.instanceOid,
              id: { in: d.magicMcpServerIds }
            },
            select: { oid: true }
          })
        : undefined,
      hasSkillFilter
        ? db.skill.findMany({
            where: {
              instanceOid: d.consumerSurface.instanceOid,
              id: { in: d.skillIds }
            },
            select: { oid: true }
          })
        : undefined,
      hasSkillTemplateFilter
        ? db.skillTemplate.findMany({
            where: {
              instanceOid: d.consumerSurface.instanceOid,
              id: { in: d.skillTemplateIds }
            },
            select: { oid: true }
          })
        : undefined,
      hasSkillGroupFilter
        ? db.skillGroup.findMany({
            where: {
              instanceOid: d.consumerSurface.instanceOid,
              id: { in: d.skillGroupIds }
            },
            select: { oid: true }
          })
        : undefined,
      hasSkillMarketplaceFilter
        ? db.skillMarketplace.findMany({
            where: {
              instanceOid: d.consumerSurface.instanceOid,
              id: { in: d.skillMarketplaceIds }
            },
            select: { oid: true }
          })
        : undefined
    ]);

    let search = d.search?.trim();
    let instance = search
      ? await db.instance.findUnique({
          where: { oid: d.consumerSurface.instanceOid },
          select: { id: true }
        })
      : undefined;
    let searchMatches = search
      ? await this.resolveSearchMatches({
          instanceId: instance?.id,
          search
        })
      : {};

    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        let filters: Prisma.ConsumerAccessListingWhereInput[] = [];

        if (d.types?.length) {
          let typeFilters: Prisma.ConsumerAccessListingWhereInput[] = [];

          if (d.types.includes('provider_template')) {
            typeFilters.push({ providerTemplateOid: { not: null } });
          }
          if (d.types.includes('magic_mcp_server')) {
            typeFilters.push({ magicMcpServerOid: { not: null } });
          }
          if (d.types.includes('skill')) {
            typeFilters.push({ skillOid: { not: null } });
          }
          if (d.types.includes('skill_template')) {
            typeFilters.push({ skillTemplateOid: { not: null } });
          }
          if (d.types.includes('skill_group')) {
            typeFilters.push({ skillGroupOid: { not: null } });
          }
          if (d.types.includes('skill_marketplace')) {
            typeFilters.push({ skillMarketplaceOid: { not: null } });
          }

          if (typeFilters.length) {
            filters.push({ OR: typeFilters });
          }
        }

        if (hasGroupFilter) {
          filters.push({
            consumerSurfaceProviderGroups: {
              some: {
                consumerSurfaceProviderGroupOid: {
                  in: groups?.map(group => group.oid) ?? []
                }
              }
            }
          });
        }

        if (hasProviderTemplateFilter) {
          filters.push({
            providerTemplateOid: {
              in: providerTemplates?.map(providerTemplate => providerTemplate.oid) ?? []
            }
          });
        }

        if (hasMagicMcpServerFilter) {
          filters.push({
            magicMcpServerOid: {
              in: magicMcpServers?.map(magicMcpServer => magicMcpServer.oid) ?? []
            }
          });
        }

        if (hasSkillFilter) {
          filters.push({
            skillOid: {
              in: skills?.map(skill => skill.oid) ?? []
            }
          });
        }

        if (hasSkillTemplateFilter) {
          filters.push({
            skillTemplateOid: {
              in: skillTemplates?.map(skillTemplate => skillTemplate.oid) ?? []
            }
          });
        }

        if (hasSkillGroupFilter) {
          filters.push({
            skillGroupOid: {
              in: skillGroups?.map(skillGroup => skillGroup.oid) ?? []
            }
          });
        }

        if (hasSkillMarketplaceFilter) {
          filters.push({
            skillMarketplaceOid: {
              in: skillMarketplaces?.map(skillMarketplace => skillMarketplace.oid) ?? []
            }
          });
        }

        if (search) {
          filters.push({
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
              {
                providerTemplate: {
                  OR: [
                    { id: { in: searchMatches.providerTemplateIds ?? [] } },
                    { name: { contains: search, mode: 'insensitive' } },
                    { description: { contains: search, mode: 'insensitive' } }
                  ]
                }
              },
              {
                magicMcpServer: {
                  OR: [
                    { id: { in: searchMatches.magicMcpServerIds ?? [] } },
                    { name: { contains: search, mode: 'insensitive' } },
                    { description: { contains: search, mode: 'insensitive' } }
                  ]
                }
              },
              {
                skill: {
                  OR: [
                    { id: { contains: search, mode: 'insensitive' } },
                    { name: { contains: search, mode: 'insensitive' } }
                  ]
                }
              },
              {
                skillTemplate: {
                  OR: [
                    { id: { contains: search, mode: 'insensitive' } },
                    { name: { contains: search, mode: 'insensitive' } },
                    { description: { contains: search, mode: 'insensitive' } }
                  ]
                }
              },
              {
                skillGroup: {
                  OR: [
                    { id: { contains: search, mode: 'insensitive' } },
                    { name: { contains: search, mode: 'insensitive' } },
                    { description: { contains: search, mode: 'insensitive' } }
                  ]
                }
              },
              {
                skillMarketplace: {
                  id: { contains: search, mode: 'insensitive' }
                }
              }
            ]
          });
        }

        filters.push({
          OR: [
            {
              providerTemplate: {
                status: 'active'
              }
            },
            {
              magicMcpServer: {
                status: 'active'
              }
            },
            {
              skill: {
                status: 'active'
              }
            },
            {
              skillTemplate: {
                status: 'active'
              }
            },
            {
              skillGroup: {
                status: 'active'
              }
            },
            {
              skillMarketplace: {
                status: 'active'
              }
            }
          ]
        });

        return await db.consumerAccessListing.findMany({
          ...opts,
          where: {
            surfaceOid: d.consumerSurface.oid,
            AND: filters
          },
          include
        });
      })
    );
  }

  async getById(d: { consumerSurface: ConsumerSurface; consumerAccessListingId: string }) {
    let listing = await db.consumerAccessListing.findFirst({
      where: {
        surfaceOid: d.consumerSurface.oid,
        id: d.consumerAccessListingId,
        OR: [
          {
            providerTemplate: {
              status: 'active'
            }
          },
          {
            magicMcpServer: {
              status: 'active'
            }
          },
          {
            skill: {
              status: 'active'
            }
          },
          {
            skillTemplate: {
              status: 'active'
            }
          },
          {
            skillGroup: {
              status: 'active'
            }
          },
          {
            skillMarketplace: {
              status: 'active'
            }
          }
        ]
      },
      include
    });

    if (!listing) {
      throw new ServiceError(notFoundError('consumer.access_listing'));
    }

    return listing;
  }

  async create(d: {
    consumerSurface: ConsumerSurface;
    input: {
      name?: string;
      description?: string | null;
      readme?: string | null;
      access: ConsumerAccessListingTargetInput;
    };
  }) {
    let target = await this.getTarget({
      consumerSurface: d.consumerSurface,
      access: d.input.access
    });
    let defaults = this.getTargetDefaultValues(target);

    return await db.consumerAccessListing.upsert({
      where:
        target.type == 'provider_template'
          ? {
              surfaceOid_providerTemplateOid: {
                surfaceOid: d.consumerSurface.oid,
                providerTemplateOid: target.providerTemplate.oid
              }
            }
          : target.type == 'magic_mcp_server'
            ? {
                surfaceOid_magicMcpServerOid: {
                  surfaceOid: d.consumerSurface.oid,
                  magicMcpServerOid: target.magicMcpServer.oid
                }
              }
            : target.type == 'skill'
              ? {
                  surfaceOid_skillOid: {
                    surfaceOid: d.consumerSurface.oid,
                    skillOid: target.skill.oid
                  }
                }
              : target.type == 'skill_template'
                ? {
                    surfaceOid_skillTemplateOid: {
                      surfaceOid: d.consumerSurface.oid,
                      skillTemplateOid: target.skillTemplate.oid
                    }
                  }
                : target.type == 'skill_group'
                  ? {
                      surfaceOid_skillGroupOid: {
                        surfaceOid: d.consumerSurface.oid,
                        skillGroupOid: target.skillGroup.oid
                      }
                    }
                  : {
                      surfaceOid_skillMarketplaceOid: {
                        surfaceOid: d.consumerSurface.oid,
                        skillMarketplaceOid: target.skillMarketplace.oid
                      }
                    },
      create: {
        id: await ID.generateId('consumerAccess'),
        surfaceOid: d.consumerSurface.oid,
        providerTemplateOid:
          target.type == 'provider_template' ? target.providerTemplate.oid : undefined,
        magicMcpServerOid:
          target.type == 'magic_mcp_server' ? target.magicMcpServer.oid : undefined,
        skillOid: target.type == 'skill' ? target.skill.oid : undefined,
        skillTemplateOid:
          target.type == 'skill_template' ? target.skillTemplate.oid : undefined,
        skillGroupOid: target.type == 'skill_group' ? target.skillGroup.oid : undefined,
        skillMarketplaceOid:
          target.type == 'skill_marketplace' ? target.skillMarketplace.oid : undefined,
        name: d.input.name ?? defaults.name,
        description: d.input.description ?? defaults.description,
        readme: d.input.readme ?? defaults.readme
      },
      update: {
        name: d.input.name ?? defaults.name,
        description: d.input.description ?? defaults.description,
        readme: d.input.readme ?? defaults.readme
      },
      include
    });
  }

  async update(d: {
    consumerAccessListing: ConsumerAccessListing;
    input: {
      name?: string;
      description?: string | null;
      readme?: string | null;
    };
  }) {
    return await db.consumerAccessListing.update({
      where: { oid: d.consumerAccessListing.oid },
      data: {
        name: d.input.name,
        description: d.input.description,
        readme: d.input.readme
      },
      include
    });
  }

  async delete(d: {
    organization: Organization;
    consumerAccessListing: ConsumerAccessListingWithRelations;
  }) {
    let accesses = await db.consumerAccess.findMany({
      where: { listingOid: d.consumerAccessListing.oid },
      include: {
        consumerGroup: true,
        providerTemplate: true,
        magicMcpServer: true,
        skill: true,
        skillTemplate: true,
        skillGroup: true,
        listing: true
      }
    });

    for (let consumerAccess of accesses) {
      await consumerAccessService.deleteConsumerAccess({
        organization: d.organization,
        consumerAccess
      });
    }

    return await withTransaction(async db => {
      await db.consumerSurfaceProviderGroupListing.deleteMany({
        where: { consumerAccessListingOid: d.consumerAccessListing.oid }
      });

      let existing = await db.consumerAccessListing.findUnique({
        where: { oid: d.consumerAccessListing.oid },
        include
      });

      if (!existing) return d.consumerAccessListing;

      return await db.consumerAccessListing.delete({
        where: { oid: d.consumerAccessListing.oid },
        include
      });
    });
  }

  private async resolveSearchMatches(d: {
    instanceId?: string;
    search?: string;
  }): Promise<ConsumerAccessListingSearchMatches> {
    let search = d.search?.trim();
    if (!search || !d.instanceId) {
      return {};
    }

    let [providerTemplateIds, magicMcpServerIds] = await Promise.all([
      searchProviderTemplateIds({
        instanceId: d.instanceId,
        query: search
      }),
      searchMagicMcpServerIds({
        instanceId: d.instanceId,
        query: search
      })
    ]);

    return {
      providerTemplateIds,
      magicMcpServerIds
    };
  }
}

export let consumerAccessListingService = Service.create(
  'consumerAccessListingService',
  () => new ConsumerAccessListingServiceImpl()
).build();
