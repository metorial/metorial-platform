import { Context } from '@metorial/context';
import { getConfig } from '@metorial/config';
import {
  Instance,
  MagicMcpServer,
  Organization,
  OrganizationActor,
  Prisma,
  ProviderTemplate,
  db
} from '@metorial/db';
import {
  notFoundError,
  preconditionFailedError,
  ServiceError,
  unauthorizedError
} from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import {
  accessTagService,
  consumerMagicMcpReadRoles,
  consumerProviderTemplateReadRoles,
  type AnyAccessTagSelector
} from '@metorial/module-access';
import { buildPortalUrlFromTemplate } from '@metorial/config/src/portalUrlTemplate';
import { magicMcpServerService } from '@metorial/module-magic';
import {
  subspaceProviderAuthConfigService,
  subspaceProviderAuthMethodService,
  subspaceProviderConfigService,
  subspaceProviderDeploymentService,
  subspaceProviderService,
  subspaceProviderSetupSessionService,
  subspaceSessionTemplateProviderService,
  subspaceSessionTemplateService
} from '@metorial/module-subspace';
import { consumerAccessPolicyService } from './accessPolicy';
import { providerTemplateService } from './providerTemplate';

type ConsumerProviderAvailability = 'available_now' | 'request_access';
type ConsumerProviderAuthMethodList = Awaited<
  ReturnType<Awaited<ReturnType<typeof subspaceProviderAuthMethodService.list>>['run']>
>['items'];
type ConsumerProviderProvisionStatus = 'pending' | 'active' | 'failed';
type ConsumerProviderProvisionMetadata = Record<string, unknown>;
type ConsumerProviderProvisionResource = {
  id: string;
  metadata: ConsumerProviderProvisionMetadata;
};

export type ConsumerProviderCatalogEntry =
  | {
      type: 'provider_template';
      availability: ConsumerProviderAvailability;
      providerTemplate: ProviderTemplate;
      deployment: Awaited<ReturnType<typeof subspaceProviderDeploymentService.get>>;
      provider: Awaited<ReturnType<typeof subspaceProviderService.get>>;
      configSchema?: Awaited<ReturnType<typeof subspaceProviderConfigService.getConfigSchema>> | null;
      authMethods?: ConsumerProviderAuthMethodList;
    }
  | {
      type: 'magic_mcp_server';
      availability: ConsumerProviderAvailability;
      magicMcpServer: ConsumerMagicMcpCatalogServer;
    };

export type ConsumerProviderTemplateCatalogEntry = Extract<
  ConsumerProviderCatalogEntry,
  {
    type: 'provider_template';
  }
>;

type ConsumerCatalogListInput = {
  limit?: number;
  after?: string;
  before?: string;
  cursor?: string;
  order?: 'asc' | 'desc';
};

type ConsumerCatalogPageDirection = 'after' | 'before';
type ConsumerCatalogBoundary = {
  id: string;
  name: string;
};

let magicMcpCatalogInclude = {
  aliases: true,
  subspaceSession: true
} as const;

type ConsumerMagicMcpCatalogServer = Prisma.MagicMcpServerGetPayload<{
  include: typeof magicMcpCatalogInclude;
}>;

let getAuthMethodList = async (d: {
  instance: Instance;
  providerVersionId: string | null | undefined;
}): Promise<ConsumerProviderAuthMethodList> => {
  if (!d.providerVersionId) {
    return [];
  }

  let paginator = await subspaceProviderAuthMethodService.list({
    instance: d.instance,
    providerVersionId: d.providerVersionId
  });
  let list = await paginator.run({
    limit: 100
  });

  return list.items;
};

let getDefaultOauthMethod = (authMethods: Awaited<ReturnType<typeof getAuthMethodList>>) => {
  return authMethods.find(authMethod => authMethod.type == 'oauth') ?? null;
};

let getConsumerProvisionMetadata = (d: {
  metadata?: Record<string, unknown> | null;
  providerTemplateId: string;
  consumerProfileId: string;
  status: ConsumerProviderProvisionStatus;
  magicMcpServerId?: string;
  failedAt?: string;
}): ConsumerProviderProvisionMetadata => {
  let existingMetadata = (d.metadata ?? {}) as Record<string, unknown>;
  let {
    failedAt: _failedAt,
    magicMcpServerId: _magicMcpServerId,
    status: _status,
    ...metadata
  } = existingMetadata;

  return {
    ...metadata,
    source: 'consumer_provider_template',
    providerTemplateId: d.providerTemplateId,
    consumerProfileId: d.consumerProfileId,
    status: d.status,
    ...(d.magicMcpServerId ? { magicMcpServerId: d.magicMcpServerId } : {}),
    ...(d.failedAt ? { failedAt: d.failedAt } : {})
  };
};

let isPreconfiguredMagicMcpServer = (magicMcpServer: { metadata: unknown }) => {
  let metadata = (magicMcpServer.metadata ?? {}) as Record<string, unknown>;

  return metadata.source != 'consumer_provider_template';
};

let getCatalogEntryId = (entry: ConsumerProviderCatalogEntry) => {
  return entry.type == 'provider_template' ? entry.providerTemplate.id : entry.magicMcpServer.id;
};

let getCatalogComparableName = (d: { name?: string | null; fallbackId: string }) => {
  return d.name?.trim() || d.fallbackId;
};

let getCatalogEntryName = (entry: ConsumerProviderCatalogEntry) => {
  return getCatalogComparableName({
    name: entry.type == 'provider_template' ? entry.providerTemplate.name : entry.magicMcpServer.name,
    fallbackId: getCatalogEntryId(entry)
  });
};

let getCatalogBoundaryComparisonOperator = (d: {
  direction: ConsumerCatalogPageDirection;
  order: 'asc' | 'desc';
}) => {
  if (d.direction == 'after') {
    return d.order == 'asc' ? 'gt' : 'lt';
  }

  return d.order == 'asc' ? 'lt' : 'gt';
};

let getReverseCatalogOrder = (order: 'asc' | 'desc') => {
  return order == 'asc' ? 'desc' : 'asc';
};

let compareCatalogEntries = (
  left: ConsumerProviderCatalogEntry,
  right: ConsumerProviderCatalogEntry,
  order: 'asc' | 'desc'
) => {
  let nameCompare = getCatalogEntryName(left).localeCompare(getCatalogEntryName(right));
  if (nameCompare != 0) {
    return order == 'asc' ? nameCompare : -nameCompare;
  }

  let idCompare = getCatalogEntryId(left).localeCompare(getCatalogEntryId(right));
  return order == 'asc' ? idCompare : -idCompare;
};

let shouldIncludeUnnamedMagicMcpBoundaryId = (d: {
  boundary: ConsumerCatalogBoundary;
  direction: ConsumerCatalogPageDirection;
  order: 'asc' | 'desc';
}) => {
  let comparison = d.boundary.name.localeCompare(d.boundary.id);
  if (d.direction == 'after') {
    return d.order == 'asc' ? comparison > 0 : comparison < 0;
  }

  return d.order == 'asc' ? comparison < 0 : comparison > 0;
};

let getProtectedConsumerProviderTemplateFilter = () => {
  return {
    some: {
      accessTagPolicy: {
        roles: {
          hasSome: [...consumerProviderTemplateReadRoles]
        }
      }
    }
  };
};

let getProtectedConsumerMagicMcpServerFilter = () => {
  return {
    some: {
      accessTagPolicy: {
        roles: {
          hasSome: [...consumerMagicMcpReadRoles]
        }
      }
    }
  };
};

class ConsumerProviderFlowServiceImpl {
  private async getCatalogBoundary(d: {
    instance: Instance;
    catalogItemId: string;
  }) {
    let providerTemplate = await db.providerTemplate.findFirst({
      where: {
        instanceOid: d.instance.oid,
        id: d.catalogItemId,
        status: 'active'
      },
      select: {
        id: true,
        name: true
      }
    });
    if (providerTemplate) {
      return {
        id: providerTemplate.id,
        name: getCatalogComparableName({
          name: providerTemplate.name,
          fallbackId: providerTemplate.id
        })
      };
    }

    let magicMcpServer = await db.magicMcpServer.findFirst({
      where: {
        instanceOid: d.instance.oid,
        id: d.catalogItemId,
        status: 'active',
        NOT: {
          metadata: {
            path: ['source'],
            equals: 'consumer_provider_template'
          }
        }
      },
      select: {
        id: true,
        name: true
      }
    });
    if (!magicMcpServer) {
      return null;
    }

    return {
      id: magicMcpServer.id,
      name: getCatalogComparableName({
        name: magicMcpServer.name,
        fallbackId: magicMcpServer.id
      })
    };
  }

  private getProviderTemplateSearchFilter(search?: string) {
    if (!search) {
      return undefined;
    }

    return {
      OR: [
        {
          name: {
            contains: search,
            mode: 'insensitive'
          }
        },
        {
          description: {
            contains: search,
            mode: 'insensitive'
          }
        }
      ]
    };
  }

  private getMagicMcpServerSearchFilter(search?: string) {
    if (!search) {
      return undefined;
    }

    return {
      OR: [
        {
          name: {
            contains: search,
            mode: 'insensitive'
          }
        },
        {
          description: {
            contains: search,
            mode: 'insensitive'
          }
        }
      ]
    };
  }

  private getNamedCatalogBoundaryFilter(d: {
    boundary?: ConsumerCatalogBoundary | null;
    direction: ConsumerCatalogPageDirection;
    order: 'asc' | 'desc';
    field: 'name';
  }) {
    if (!d.boundary) {
      return undefined;
    }

    let operator = getCatalogBoundaryComparisonOperator(d);

    return {
      OR: [
        {
          [d.field]: {
            [operator]: d.boundary.name
          }
        },
        {
          [d.field]: d.boundary.name,
          id: {
            [operator]: d.boundary.id
          }
        }
      ]
    };
  }

  private getUnnamedMagicMcpBoundaryFilter(d: {
    boundary?: ConsumerCatalogBoundary | null;
    direction: ConsumerCatalogPageDirection;
    order: 'asc' | 'desc';
  }) {
    if (!d.boundary) {
      return undefined;
    }

    let operator = getCatalogBoundaryComparisonOperator(d);
    let shouldIncludeBoundaryId = shouldIncludeUnnamedMagicMcpBoundaryId({
      boundary: d.boundary,
      direction: d.direction,
      order: d.order
    });

    return {
      OR: [
        {
          id: {
            [operator]: d.boundary.name
          }
        },
        ...(shouldIncludeBoundaryId
          ? [
              {
                id: d.boundary.name
              }
            ]
          : [])
      ]
    };
  }

  private async listProviderTemplateCatalogCandidates(d: {
    instance: Instance;
    search?: string;
    limit: number;
    direction: ConsumerCatalogPageDirection;
    order: 'asc' | 'desc';
    boundary?: ConsumerCatalogBoundary | null;
  }) {
    let queryOrder = d.direction == 'before' ? getReverseCatalogOrder(d.order) : d.order;
    let filters: Prisma.ProviderTemplateWhereInput[] = [];
    let searchFilter = this.getProviderTemplateSearchFilter(d.search);
    let boundaryFilter = this.getNamedCatalogBoundaryFilter({
      boundary: d.boundary,
      direction: d.direction,
      order: d.order,
      field: 'name'
    });

    if (searchFilter) {
      filters.push(searchFilter as Prisma.ProviderTemplateWhereInput);
    }
    if (boundaryFilter) {
      filters.push(boundaryFilter as Prisma.ProviderTemplateWhereInput);
    }

    let providerTemplates = await db.providerTemplate.findMany({
      where: {
        instanceOid: d.instance.oid,
        status: 'active',
        AND: filters
      },
      orderBy: [{ name: queryOrder }, { id: queryOrder }],
      take: d.limit + 1
    });

    return {
      items: providerTemplates.slice(0, d.limit),
      hasMore: providerTemplates.length > d.limit
    };
  }

  private async listNamedMagicMcpServerCatalogCandidates(d: {
    instance: Instance;
    search?: string;
    limit: number;
    direction: ConsumerCatalogPageDirection;
    order: 'asc' | 'desc';
    boundary?: ConsumerCatalogBoundary | null;
  }) {
    let queryOrder = d.direction == 'before' ? getReverseCatalogOrder(d.order) : d.order;
    let filters: Prisma.MagicMcpServerWhereInput[] = [
      {
        NOT: {
          metadata: {
            path: ['source'],
            equals: 'consumer_provider_template'
          }
        }
      }
    ];
    let searchFilter = this.getMagicMcpServerSearchFilter(d.search);
    let boundaryFilter = this.getNamedCatalogBoundaryFilter({
      boundary: d.boundary,
      direction: d.direction,
      order: d.order,
      field: 'name'
    });

    if (searchFilter) {
      filters.push(searchFilter as Prisma.MagicMcpServerWhereInput);
    }
    if (boundaryFilter) {
      filters.push(boundaryFilter as Prisma.MagicMcpServerWhereInput);
    }

    let magicMcpServers = await db.magicMcpServer.findMany({
      where: {
        instanceOid: d.instance.oid,
        status: 'active',
        name: {
          not: null
        },
        AND: filters
      },
      include: magicMcpCatalogInclude,
      orderBy: [{ name: queryOrder }, { id: queryOrder }],
      take: d.limit + 1
    });

    return {
      items: magicMcpServers.slice(0, d.limit),
      hasMore: magicMcpServers.length > d.limit
    };
  }

  private async listUnnamedMagicMcpServerCatalogCandidates(d: {
    instance: Instance;
    search?: string;
    limit: number;
    direction: ConsumerCatalogPageDirection;
    order: 'asc' | 'desc';
    boundary?: ConsumerCatalogBoundary | null;
  }) {
    let queryOrder = d.direction == 'before' ? getReverseCatalogOrder(d.order) : d.order;
    let filters: Prisma.MagicMcpServerWhereInput[] = [
      {
        NOT: {
          metadata: {
            path: ['source'],
            equals: 'consumer_provider_template'
          }
        }
      }
    ];
    let searchFilter = this.getMagicMcpServerSearchFilter(d.search);
    let boundaryFilter = this.getUnnamedMagicMcpBoundaryFilter({
      boundary: d.boundary,
      direction: d.direction,
      order: d.order
    });

    if (searchFilter) {
      filters.push(searchFilter as Prisma.MagicMcpServerWhereInput);
    }
    if (boundaryFilter) {
      filters.push(boundaryFilter as Prisma.MagicMcpServerWhereInput);
    }

    let magicMcpServers = await db.magicMcpServer.findMany({
      where: {
        instanceOid: d.instance.oid,
        status: 'active',
        name: null,
        AND: filters
      },
      include: magicMcpCatalogInclude,
      orderBy: [{ id: queryOrder }],
      take: d.limit + 1
    });

    return {
      items: magicMcpServers.slice(0, d.limit),
      hasMore: magicMcpServers.length > d.limit
    };
  }

  private async hydratePreconfiguredMagicMcpServers(d: {
    magicMcpServers: ConsumerMagicMcpCatalogServer[];
    accessTags?: AnyAccessTagSelector;
  }): Promise<
    Extract<
      ConsumerProviderCatalogEntry,
      {
        type: 'magic_mcp_server';
      }
    >[]
  > {
    if (!d.magicMcpServers.length) {
      return [];
    }

    let accessibleMagicMcpServerOids: Set<bigint> | null = null;
    let protectedMagicMcpServers = await db.magicMcpServer.findMany({
      where: {
        oid: {
          in: d.magicMcpServers.map(magicMcpServer => magicMcpServer.oid)
        },
        accessTagEntities: getProtectedConsumerMagicMcpServerFilter()
      },
      select: {
        oid: true
      }
    });
    let protectedMagicMcpServerOids = new Set(
      protectedMagicMcpServers.map(magicMcpServer => magicMcpServer.oid)
    );

    if (d.accessTags) {
      let accessTagFilter = await accessTagService.getAccessTagFilter({
        tags: d.accessTags,
        roles: [...consumerMagicMcpReadRoles]
      });

      let accessibleMagicMcpServers = await db.magicMcpServer.findMany({
        where: {
          oid: {
            in: d.magicMcpServers.map(magicMcpServer => magicMcpServer.oid)
          },
          accessTagEntities: accessTagFilter
        },
        select: {
          oid: true
        }
      });

      accessibleMagicMcpServerOids = new Set(
        accessibleMagicMcpServers.map(magicMcpServer => magicMcpServer.oid)
      );
    }

    return d.magicMcpServers.map(magicMcpServer => ({
      type: 'magic_mcp_server' as const,
      availability:
        accessibleMagicMcpServerOids?.has(magicMcpServer.oid) ||
        !protectedMagicMcpServerOids?.has(magicMcpServer.oid)
          ? 'available_now'
          : 'request_access',
      magicMcpServer
    }));
  }

  private async markProvisionActive(d: {
    instance: Instance;
    context: Context;
    providerConfig?: ConsumerProviderProvisionResource;
    providerAuthConfig?: ConsumerProviderProvisionResource;
    sessionTemplate?: ConsumerProviderProvisionResource;
    magicMcpServerId: string;
  }) {
    await Promise.all([
      d.providerConfig
        ? subspaceProviderConfigService.update({
            instance: d.instance,
            providerConfigId: d.providerConfig.id,
            metadata: {
              ...d.providerConfig.metadata,
              status: 'active',
              magicMcpServerId: d.magicMcpServerId
            }
          })
        : Promise.resolve(),
      d.providerAuthConfig
        ? subspaceProviderAuthConfigService.update({
            instance: d.instance,
            providerAuthConfigId: d.providerAuthConfig.id,
            metadata: {
              ...d.providerAuthConfig.metadata,
              status: 'active',
              magicMcpServerId: d.magicMcpServerId
            },
            ip: d.context.ip,
            ua: d.context.ua ?? ''
          })
        : Promise.resolve(),
      d.sessionTemplate
        ? subspaceSessionTemplateService.update({
            instance: d.instance,
            sessionTemplateId: d.sessionTemplate.id,
            metadata: {
              ...d.sessionTemplate.metadata,
              status: 'active',
              magicMcpServerId: d.magicMcpServerId
            }
          })
        : Promise.resolve()
    ]);
  }

  private async compensateFailedProvision(d: {
    instance: Instance;
    context: Context;
    providerConfig?: ConsumerProviderProvisionResource;
    providerAuthConfig?: ConsumerProviderProvisionResource;
    sessionTemplate?: ConsumerProviderProvisionResource;
    sessionTemplateProviderId?: string;
    magicMcpServer?: MagicMcpServer;
  }) {
    let failedAt = new Date().toISOString();

    await Promise.all([
      d.magicMcpServer
        ? magicMcpServerService.archiveMagicMcpServer({
            server: d.magicMcpServer
          })
        : Promise.resolve(),
      d.sessionTemplateProviderId
        ? subspaceSessionTemplateProviderService.delete({
            instance: d.instance,
            sessionTemplateProviderId: d.sessionTemplateProviderId
          })
        : Promise.resolve(),
      d.providerConfig
        ? subspaceProviderConfigService.update({
            instance: d.instance,
            providerConfigId: d.providerConfig.id,
            metadata: {
              ...d.providerConfig.metadata,
              status: 'failed',
              failedAt
            }
          })
        : Promise.resolve(),
      d.providerAuthConfig
        ? subspaceProviderAuthConfigService.update({
            instance: d.instance,
            providerAuthConfigId: d.providerAuthConfig.id,
            metadata: {
              ...d.providerAuthConfig.metadata,
              status: 'failed',
              failedAt
            },
            ip: d.context.ip,
            ua: d.context.ua ?? ''
          })
        : Promise.resolve(),
      d.sessionTemplate
        ? subspaceSessionTemplateService.update({
            instance: d.instance,
            sessionTemplateId: d.sessionTemplate.id,
            metadata: {
              ...d.sessionTemplate.metadata,
              status: 'failed',
              failedAt
            }
          })
        : Promise.resolve()
    ]);
  }

  async listConsumerCatalogEntries(d: {
    instance: Instance;
    search?: string;
    accessTags?: AnyAccessTagSelector;
    includeCapabilities?: boolean;
    pagination?: ConsumerCatalogListInput;
  }) {
    let limit = d.pagination?.limit ?? 50;
    let order = d.pagination?.order ?? 'asc';
    let direction: ConsumerCatalogPageDirection = d.pagination?.before ? 'before' : 'after';
    let boundaryId = d.pagination?.before ?? d.pagination?.cursor ?? d.pagination?.after;
    let boundary = boundaryId
      ? await this.getCatalogBoundary({
          instance: d.instance,
          catalogItemId: boundaryId
        })
      : null;

    let [providerTemplatePage, namedMagicMcpServerPage, unnamedMagicMcpServerPage] =
      await Promise.all([
        this.listProviderTemplateCatalogCandidates({
          instance: d.instance,
          search: d.search,
          limit,
          direction,
          order,
          boundary
        }),
        this.listNamedMagicMcpServerCatalogCandidates({
          instance: d.instance,
          search: d.search,
          limit,
          direction,
          order,
          boundary
        }),
        this.listUnnamedMagicMcpServerCatalogCandidates({
          instance: d.instance,
          search: d.search,
          limit,
          direction,
          order,
          boundary
        })
      ]);

    let [providerEntries, namedMagicMcpServerEntries, unnamedMagicMcpServerEntries] =
      await Promise.all([
        this.hydrateConsumerProviders({
          instance: d.instance,
          providerTemplates: providerTemplatePage.items,
          includeCapabilities: d.includeCapabilities,
          accessTags: d.accessTags
        }),
        this.hydratePreconfiguredMagicMcpServers({
          magicMcpServers: namedMagicMcpServerPage.items,
          accessTags: d.accessTags
        }),
        this.hydratePreconfiguredMagicMcpServers({
          magicMcpServers: unnamedMagicMcpServerPage.items,
          accessTags: d.accessTags
        })
      ]);

    let queryOrder = direction == 'before' ? getReverseCatalogOrder(order) : order;
    let entries = [
      ...providerEntries,
      ...namedMagicMcpServerEntries,
      ...unnamedMagicMcpServerEntries
    ].sort((left, right) => compareCatalogEntries(left, right, queryOrder));
    let hasMoreInQueryDirection =
      entries.length > limit ||
      providerTemplatePage.hasMore ||
      namedMagicMcpServerPage.hasMore ||
      unnamedMagicMcpServerPage.hasMore;
    let items = entries.slice(0, limit);

    if (direction == 'before') {
      items.reverse();
    }

    return {
      items,
      pagination: {
        hasNextPage: direction == 'before' ? !!boundary : hasMoreInQueryDirection,
        hasPreviousPage: direction == 'before' ? hasMoreInQueryDirection : !!boundary
      }
    };
  }

  async listFeaturedConsumerCatalogEntries(d: {
    instance: Instance;
    accessTags?: AnyAccessTagSelector;
    limit?: number;
  }) {
    let list = await this.listConsumerCatalogEntries({
      instance: d.instance,
      accessTags: d.accessTags,
      pagination: {
        limit: d.limit ?? 6,
        order: 'asc'
      }
    });

    return list.items;
  }

  async hydrateConsumerProviders(d: {
    instance: Instance;
    providerTemplates: ProviderTemplate[];
    includeCapabilities?: boolean;
    accessTags?: AnyAccessTagSelector;
  }): Promise<ConsumerProviderTemplateCatalogEntry[]> {
    if (!d.providerTemplates.length) {
      return [];
    }

    let accessibleTemplateOids: Set<bigint> | null = null;
    let protectedTemplates = await db.providerTemplate.findMany({
      where: {
        oid: {
          in: d.providerTemplates.map(providerTemplate => providerTemplate.oid)
        },
        accessTagEntities: getProtectedConsumerProviderTemplateFilter()
      },
      select: {
        oid: true
      }
    });
    let protectedTemplateOids = new Set(
      protectedTemplates.map(providerTemplate => providerTemplate.oid)
    );

    if (d.accessTags) {
      let accessTagFilter = await accessTagService.getAccessTagFilter({
        tags: d.accessTags,
        roles: [...consumerProviderTemplateReadRoles]
      });

      let accessibleTemplates = await db.providerTemplate.findMany({
        where: {
          oid: {
            in: d.providerTemplates.map(providerTemplate => providerTemplate.oid)
          },
          accessTagEntities: accessTagFilter
        },
        select: {
          oid: true
        }
      });

      accessibleTemplateOids = new Set(
        accessibleTemplates.map(providerTemplate => providerTemplate.oid)
      );
    }

    let deployments = await Promise.all(
      d.providerTemplates.map(async providerTemplate => {
        return [
          providerTemplate.providerDeploymentId,
          await subspaceProviderDeploymentService.get({
            instance: d.instance,
            providerDeploymentId: providerTemplate.providerDeploymentId
          })
        ] as const;
      })
    );
    let deploymentMap = new Map(deployments);

    let providers = await Promise.all(
      Array.from(
        new Set(
          deployments.map(([, deployment]) => {
            return deployment.providerId;
          })
        )
      ).map(async providerId => {
        return [
          providerId,
          await subspaceProviderService.get({
            instance: d.instance,
            providerId
          })
        ] as const;
      })
    );
    let providerMap = new Map(providers);

    let configSchemaMap = new Map<string, ConsumerProviderTemplateCatalogEntry['configSchema']>();
    let authMethodMap = new Map<string, ConsumerProviderTemplateCatalogEntry['authMethods']>();

    if (d.includeCapabilities) {
      await Promise.all(
        deployments.map(async ([deploymentId, deployment]) => {
          let providerTemplatesForDeployment = d.providerTemplates.filter(providerTemplate => {
            return providerTemplate.providerDeploymentId == deploymentId;
          });
          let isDeploymentAccessible =
            providerTemplatesForDeployment.some(providerTemplate => {
              return (
                accessibleTemplateOids?.has(providerTemplate.oid) ||
                !protectedTemplateOids?.has(providerTemplate.oid)
              );
            });

          if (!isDeploymentAccessible) {
            return;
          }

          let configSchema = await subspaceProviderConfigService.getConfigSchema({
            instance: d.instance,
            providerDeploymentId: deploymentId
          });
          configSchemaMap.set(deploymentId, configSchema);
          authMethodMap.set(
            deploymentId,
            await getAuthMethodList({
              instance: d.instance,
              providerVersionId: deployment.lockedVersion?.id
            })
          );
        })
      );
    }

    return d.providerTemplates.map(providerTemplate => {
      let deployment = deploymentMap.get(providerTemplate.providerDeploymentId);
      if (!deployment) {
        throw new ServiceError(notFoundError('provider.deployment'));
      }

      let provider = providerMap.get(deployment.providerId);
      if (!provider) {
        throw new ServiceError(notFoundError('provider'));
      }

      let isAvailableNow =
        accessibleTemplateOids?.has(providerTemplate.oid) ||
        !protectedTemplateOids?.has(providerTemplate.oid);

      return {
        type: 'provider_template' as const,
        availability: isAvailableNow ? 'available_now' : 'request_access',
        providerTemplate,
        deployment,
        provider,
        configSchema: isAvailableNow
          ? configSchemaMap.get(providerTemplate.providerDeploymentId) ?? null
          : null,
        authMethods: isAvailableNow
          ? authMethodMap.get(providerTemplate.providerDeploymentId) ?? []
          : []
      };
    });
  }

  async getConsumerProviderCatalogEntry(d: {
    instance: Instance;
    catalogItemId: string;
    accessTags?: AnyAccessTagSelector;
    includeCapabilities?: boolean;
  }): Promise<ConsumerProviderCatalogEntry> {
    let providerTemplate = await db.providerTemplate.findFirst({
      where: {
        instanceOid: d.instance.oid,
        id: d.catalogItemId,
        status: 'active'
      }
    });

    if (providerTemplate) {
      return (
        await this.hydrateConsumerProviders({
          instance: d.instance,
          providerTemplates: [providerTemplate],
          includeCapabilities: d.includeCapabilities,
          accessTags: d.accessTags
        })
      )[0];
    }

    let magicMcpServer = await db.magicMcpServer.findFirst({
      where: {
        instanceOid: d.instance.oid,
        id: d.catalogItemId,
        status: 'active'
      },
      include: magicMcpCatalogInclude
    });

    if (!magicMcpServer || !isPreconfiguredMagicMcpServer(magicMcpServer)) {
      throw new ServiceError(notFoundError('provider.template'));
    }

    return (
      await this.hydratePreconfiguredMagicMcpServers({
        magicMcpServers: [magicMcpServer],
        accessTags: d.accessTags
      })
    )[0];
  }

  async createConsumerProviderSetupSession(d: {
    instance: Instance;
    context: Context;
    accessTags: AnyAccessTagSelector;
    consumerSurfaceOid: bigint;
    consumerProfileId: string;
    providerTemplateId: string;
    input: {
      providerAuthMethodId?: string;
    };
  }) {
    let providerTemplate = await providerTemplateService.getProviderTemplateById({
      instance: d.instance,
      providerTemplateId: d.providerTemplateId,
      accessTags: d.accessTags
    });

    let deployment = await subspaceProviderDeploymentService.get({
      instance: d.instance,
      providerDeploymentId: providerTemplate.providerDeploymentId
    });
    let provider = await subspaceProviderService.get({
      instance: d.instance,
      providerId: deployment.providerId
    });

    let authMethods = await getAuthMethodList({
      instance: d.instance,
      providerVersionId: deployment.lockedVersion?.id
    });

    let authMethod =
      (d.input.providerAuthMethodId
        ? authMethods.find(method => method.id == d.input.providerAuthMethodId)
        : getDefaultOauthMethod(authMethods)) ?? null;

    if (!authMethod || authMethod.type != 'oauth') {
      throw new ServiceError(
        preconditionFailedError({
          message: 'This provider template does not expose an OAuth setup flow.'
        })
      );
    }

    let portal = await db.portal.findFirst({
      where: {
        instanceOid: d.instance.oid,
        surfaceOid: d.consumerSurfaceOid
      },
      select: {
        slug: true
      }
    });
    if (!portal) {
      throw new ServiceError(notFoundError('portal'));
    }

    return await subspaceProviderSetupSessionService.create({
      instance: d.instance,
      providerId: provider.id,
      providerDeploymentId: deployment.id,
      providerAuthMethodId: authMethod.id,
      name: provider.name,
      description: provider.description ?? undefined,
      uiMode: 'metorial_elements',
      type: 'auth_only',
      ip: d.context.ip,
      ua: d.context.ua ?? '',
      redirectUrl: buildPortalUrlFromTemplate(getConfig().portalHostTemplate, portal.slug),
      metadata: {
        source: 'consumer_provider_template',
        providerTemplateId: providerTemplate.id,
        consumerProfileId: d.consumerProfileId
      }
    });
  }

  async getConsumerProviderSetupSession(d: {
    instance: Instance;
    accessTags: AnyAccessTagSelector;
    consumerProfileId: string;
    providerTemplateId: string;
    providerSetupSessionId: string;
  }) {
    let providerTemplate = await providerTemplateService.getProviderTemplateById({
      instance: d.instance,
      providerTemplateId: d.providerTemplateId,
      accessTags: d.accessTags
    });

    let deployment = await subspaceProviderDeploymentService.get({
      instance: d.instance,
      providerDeploymentId: providerTemplate.providerDeploymentId
    });
    let provider = await subspaceProviderService.get({
      instance: d.instance,
      providerId: deployment.providerId
    });

    let setupSession = await subspaceProviderSetupSessionService.get({
      instance: d.instance,
      providerSetupSessionId: d.providerSetupSessionId
    });

    let setupSessionMetadata = (setupSession.metadata ?? {}) as Record<string, unknown>;
    if (setupSessionMetadata.consumerProfileId != d.consumerProfileId) {
      throw new ServiceError(
        unauthorizedError({
          message: 'The selected provider setup session does not belong to this consumer.'
        })
      );
    }

    if (setupSessionMetadata.providerTemplateId != providerTemplate.id) {
      throw new ServiceError(
        unauthorizedError({
          message: 'The selected provider setup session does not belong to this template.'
        })
      );
    }

    if (setupSession.providerId != provider.id || setupSession.deployment?.id != deployment.id) {
      throw new ServiceError(
        preconditionFailedError({
          message: 'The selected provider setup session does not match this template.'
        })
      );
    }

    return setupSession;
  }

  async deployConsumerProvider(d: {
    organization: Organization;
    performedBy: OrganizationActor;
    instance: Instance;
    context: Context;
    consumerProfile: {
      id: string;
      email: string;
      oid: bigint;
      personalConsumerGroupOid: bigint;
    };
    accessTags: AnyAccessTagSelector;
    providerTemplateId: string;
    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, unknown>;
      config?: Record<string, unknown>;
      auth?:
        | {
            type: 'setup_session';
            providerSetupSessionId: string;
          }
        | {
            type: 'manual';
            providerAuthMethodId: string;
            value: Record<string, unknown>;
          };
    };
  }) {
    let providerTemplate = await providerTemplateService.getProviderTemplateById({
      instance: d.instance,
      providerTemplateId: d.providerTemplateId,
      accessTags: d.accessTags
    });

    let deployment = await subspaceProviderDeploymentService.get({
      instance: d.instance,
      providerDeploymentId: providerTemplate.providerDeploymentId
    });
    let provider = await subspaceProviderService.get({
      instance: d.instance,
      providerId: deployment.providerId
    });

    let authMethods = await getAuthMethodList({
      instance: d.instance,
      providerVersionId: deployment.lockedVersion?.id
    });
    let configSchema = await subspaceProviderConfigService.getConfigSchema({
      instance: d.instance,
      providerDeploymentId: deployment.id
    });

    let hasConfigSchema = !!Object.keys(configSchema?.configSchema ?? {}).length;
    let hasInputConfig = d.input.config != undefined;
    if (hasConfigSchema && !deployment.defaultConfig && !hasInputConfig) {
      throw new ServiceError(
        preconditionFailedError({
          message: 'This provider template requires configuration before deployment.'
        })
      );
    }

    if (!d.input.auth && authMethods.length > 0) {
      throw new ServiceError(
        preconditionFailedError({
          message: 'This provider template requires authentication before deployment.'
        })
      );
    }

    let providerConfig: ConsumerProviderProvisionResource | undefined;
    let providerAuthConfig: ConsumerProviderProvisionResource | undefined;
    let providerAuthConfigId: string | undefined;
    let sessionTemplate: ConsumerProviderProvisionResource | undefined;
    let sessionTemplateProviderId: string | undefined;
    let magicMcpServer: MagicMcpServer | undefined;

    try {
      if (hasInputConfig) {
        let providerConfigMetadata = getConsumerProvisionMetadata({
          providerTemplateId: providerTemplate.id,
          consumerProfileId: d.consumerProfile.id,
          status: 'pending'
        });
        let createdProviderConfig = await subspaceProviderConfigService.create({
          instance: d.instance,
          providerId: provider.id,
          providerDeployment: {
            type: 'reference',
            providerDeploymentId: deployment.id
          },
          name: `${provider.name} Config`,
          description: `Portal configuration for ${provider.name}`,
          metadata: providerConfigMetadata,
          config: {
            type: 'inline',
            data: d.input.config ?? {}
          }
        });
        providerConfig = {
          id: createdProviderConfig.id,
          metadata: providerConfigMetadata
        };
      }

      if (d.input.auth?.type == 'setup_session') {
        let setupSession = await subspaceProviderSetupSessionService.get({
          instance: d.instance,
          providerSetupSessionId: d.input.auth.providerSetupSessionId
        });

        if (setupSession.status != 'completed' || !setupSession.authConfig?.id) {
          throw new ServiceError(
            preconditionFailedError({
              message: 'The selected provider setup session is not completed yet.'
            })
          );
        }

        if (
          setupSession.providerId != provider.id ||
          setupSession.deployment?.id != deployment.id
        ) {
          throw new ServiceError(
            preconditionFailedError({
              message: 'The selected provider setup session does not match this template.'
            })
          );
        }

        let setupSessionMetadata = (setupSession.metadata ?? {}) as Record<string, unknown>;
        if (setupSessionMetadata.consumerProfileId != d.consumerProfile.id) {
          throw new ServiceError(
            unauthorizedError({
              message: 'The selected provider setup session does not belong to this consumer.'
            })
          );
        }
        if (setupSessionMetadata.providerTemplateId != providerTemplate.id) {
          throw new ServiceError(
            unauthorizedError({
              message: 'The selected provider setup session does not belong to this template.'
            })
          );
        }

        providerAuthConfigId = setupSession.authConfig.id;
      } else if (d.input.auth?.type == 'manual') {
        let manualAuth = d.input.auth;
        let authMethod = authMethods.find(candidate => {
          return candidate.id == manualAuth.providerAuthMethodId;
        });

        if (!authMethod) {
          throw new ServiceError(notFoundError('provider.auth_method'));
        }

        let providerAuthConfigMetadata = getConsumerProvisionMetadata({
          providerTemplateId: providerTemplate.id,
          consumerProfileId: d.consumerProfile.id,
          status: 'pending'
        });
        let authConfig = await subspaceProviderAuthConfigService.create({
          instance: d.instance,
          providerId: provider.id,
          providerAuthMethodId: authMethod.id,
          providerDeployment: {
            type: 'reference',
            providerDeploymentId: deployment.id
          },
          name: `${provider.name} Auth`,
          description: `Portal authentication for ${provider.name}`,
          ip: d.context.ip,
          ua: d.context.ua ?? '',
          metadata: providerAuthConfigMetadata,
          config: manualAuth.value
        });

        providerAuthConfig = {
          id: authConfig.id,
          metadata: providerAuthConfigMetadata
        };
        providerAuthConfigId = authConfig.id;
      }

      let sessionTemplateMetadata = getConsumerProvisionMetadata({
        metadata: d.input.metadata,
        providerTemplateId: providerTemplate.id,
        consumerProfileId: d.consumerProfile.id,
        status: 'pending'
      });
      let createdSessionTemplate = await subspaceSessionTemplateService.create({
        instance: d.instance,
        name: d.input.name ?? providerTemplate.name,
        description:
          d.input.description ??
          providerTemplate.description ??
          provider.description ??
          undefined,
        metadata: sessionTemplateMetadata,
        providers: []
      });
      sessionTemplate = {
        id: createdSessionTemplate.id,
        metadata: sessionTemplateMetadata
      };

      let sessionTemplateProvider = await subspaceSessionTemplateProviderService.create({
        instance: d.instance,
        sessionTemplateId: sessionTemplate.id,
        providerDeploymentId: deployment.id,
        providerConfigId: providerConfig?.id,
        providerAuthConfigId
      });
      sessionTemplateProviderId = sessionTemplateProvider.id;

      magicMcpServer = await magicMcpServerService.createMagicMcpServer({
        organization: d.organization,
        performedBy: d.performedBy,
        instance: d.instance,
        context: d.context,
        input: {
          name: d.input.name ?? provider.name,
          description:
            d.input.description ??
            providerTemplate.description ??
            deployment.description ??
            provider.description ??
            undefined,
          metadata: {
            ...(d.input.metadata ?? {}),
            source: 'consumer_provider_template',
            providerTemplateId: providerTemplate.id
          },
          sessionTemplateId: sessionTemplate.id
        }
      });

      for (let permission of ['magic_mcp_read', 'magic_mcp_write'] as const) {
        await consumerAccessPolicyService.grantAccess({
          organization: d.organization,
          permission,
          subject: {
            personalConsumerGroupForProfile: d.consumerProfile
          },
          resource: {
            magicMcpServer
          }
        });
      }

      await this.markProvisionActive({
        instance: d.instance,
        context: d.context,
        providerConfig,
        providerAuthConfig,
        sessionTemplate,
        magicMcpServerId: magicMcpServer.id
      });

      return magicMcpServer;
    } catch (error) {
      try {
        await this.compensateFailedProvision({
          instance: d.instance,
          context: d.context,
          providerConfig,
          providerAuthConfig,
          sessionTemplate,
          sessionTemplateProviderId,
          magicMcpServer
        });
      } catch (compensationError) {
        throw new AggregateError(
          [error, compensationError],
          'Consumer provider provisioning failed and cleanup was incomplete.'
        );
      }

      throw error;
    }
  }
}

export let consumerProviderFlowService = Service.create(
  'consumerProviderFlowService',
  () => new ConsumerProviderFlowServiceImpl()
).build();
