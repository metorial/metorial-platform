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
  withTransaction
} from '@metorial/db';
import {
  searchConsumerGroupIds,
  searchMagicMcpServerIds,
  searchProviderTemplateIds
} from '@metorial/module-search';
import { isPreconfiguredMagicMcpServer } from '../lib/magicMcpServerSource';
import { consumerAccessPolicyService } from './accessPolicy';

let include = {
  consumerGroup: true,
  providerTemplate: true,
  magicMcpServer: true,
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
    };

type ConsumerAccessWithRelations = ConsumerAccess & {
  consumerGroup: ConsumerGroup;
  providerTemplate: ProviderTemplate | null;
  magicMcpServer: MagicMcpServer | null;
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
            : {
                surfaceOid_magicMcpServerOid: {
                  surfaceOid: d.consumerSurface.oid,
                  magicMcpServerOid: d.access.magicMcpServer!.oid
                }
              },
        create: {
          id: await ID.generateId('consumerAccess'),
          surfaceOid: d.consumerSurface.oid,
          providerTemplateOid:
            d.access.type == 'provider_template' ? d.access.providerTemplate!.oid : undefined,
          magicMcpServerOid:
            d.access.type == 'magic_mcp_server' ? d.access.magicMcpServer!.oid : undefined,
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
            : {
                surfaceOid: d.consumerSurface.oid,
                magicMcpServerOid: d.access.magicMcpServer!.oid
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
    types?: ConsumerAccessTargetType[];
    search?: string;
  }) {
    let search = d.search?.trim();
    let hasConsumerGroupFilter = !!d.consumerGroupIds?.length;
    let hasProviderTemplateFilter = !!d.providerTemplateIds?.length;
    let hasMagicMcpServerFilter = !!d.magicMcpServerIds?.length;
    let instance = search
      ? await db.instance.findFirst({
          where: {
            oid: d.consumerSurface.instanceOid
          },
          select: {
            id: true
          }
        })
      : null;
    let [searchedConsumerGroupIds, searchedProviderTemplateIds, searchedMagicMcpServerIds] =
      search && instance
        ? await Promise.all([
            searchConsumerGroupIds({
              instanceId: instance.id,
              query: search
            }),
            searchProviderTemplateIds({
              instanceId: instance.id,
              query: search
            }),
            searchMagicMcpServerIds({
              instanceId: instance.id,
              query: search
            })
          ])
        : [undefined, undefined, undefined];
    let [searchedConsumerGroups, searchedProviderTemplates, searchedMagicMcpServers] = search
      ? await Promise.all([
          db.consumerGroup.findMany({
            where: {
              surfaceOid: d.consumerSurface.oid,
              id: {
                in: searchedConsumerGroupIds ?? []
              }
            },
            select: {
              oid: true
            }
          }),
          db.providerTemplate.findMany({
            where: {
              instanceOid: d.consumerSurface.instanceOid,
              id: {
                in: searchedProviderTemplateIds ?? []
              }
            },
            select: {
              oid: true
            }
          }),
          db.magicMcpServer.findMany({
            where: {
              instanceOid: d.consumerSurface.instanceOid,
              id: {
                in: searchedMagicMcpServerIds ?? []
              }
            },
            select: {
              oid: true
            }
          })
        ])
      : [undefined, undefined, undefined];

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
                  : undefined
              },
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
                  }
                ]
              },
              ...(search
                ? [
                    {
                      OR: [
                        {
                          consumerGroupOid: {
                            in: searchedConsumerGroups?.map(group => group.oid) ?? []
                          }
                        },
                        {
                          providerTemplateOid: {
                            in:
                              searchedProviderTemplates?.map(
                                providerTemplate => providerTemplate.oid
                              ) ?? []
                          }
                        },
                        {
                          magicMcpServerOid: {
                            in:
                              searchedMagicMcpServers?.map(
                                magicMcpServer => magicMcpServer.oid
                              ) ?? []
                          }
                        }
                      ]
                    }
                  ]
                : [])
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
        d.access.magicMcpServer.instanceOid != d.consumerSurface.instanceOid)
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
            : {
                consumerGroupOid_magicMcpServerOid: {
                  consumerGroupOid: d.consumerGroup.oid,
                  magicMcpServerOid: d.access.magicMcpServer.oid
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
            d.access.type == 'magic_mcp_server' ? d.access.magicMcpServer.oid : undefined
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
      } else {
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
