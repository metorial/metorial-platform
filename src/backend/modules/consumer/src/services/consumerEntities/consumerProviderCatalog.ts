import { notFoundError, ServiceError } from '@mtsrc/error';
import { Paginator, type PaginatorInput } from '@mtsrc/pagination';
import { Service } from '@mtsrc/service';
import {
  ConsumerAccessListing,
  ConsumerGroup,
  ConsumerProfile,
  ConsumerSurface,
  db,
  Prisma,
  ProviderTemplate,
  type Instance
} from '@metorial/db';
import {
  accessTagService,
  consumerMagicMcpReadRoles,
  consumerProviderTemplateReadRoles,
  type AnyAccessTagSelector
} from '@metorial/module-access';
import { searchMagicMcpServerIds, searchProviderTemplateIds } from '@metorial/module-search';
import {
  subspaceMagicMcpBackingService,
  subspaceProviderConfigService,
  subspaceProviderDeploymentService,
  subspaceProviderService
} from '@metorial/module-subspace';
import {
  getProviderVersionIdForAuthMethods,
  listProviderAuthMethods,
  type ConsumerProvider,
  type ConsumerProviderAuthMethodList,
  type ConsumerProviderConfigSchema,
  type ConsumerProviderDeployment
} from '../../lib/consumerProviderContext';

export type ConsumerProviderAvailability = 'available_now' | 'request_access';

export type ConsumerCatalogListInput = PaginatorInput;

let magicMcpCatalogInclude = {
  aliases: true,
  subspaceSession: true
} as const;

type ConsumerMagicMcpCatalogServer = Prisma.MagicMcpServerGetPayload<{
  include: typeof magicMcpCatalogInclude;
}>;

type ConsumerCatalogRecord = ConsumerAccessListing & {
  providerTemplate: ProviderTemplate | null;
  magicMcpServer: ConsumerMagicMcpCatalogServer | null;
  consumerAccesses: {
    id: string;
  }[];
};

type ConsumerProviderCatalogBase = {
  id: string;
  listing: ConsumerAccessListing;
  name: string;
  description: string | null;
  readme: string | null;
  availability: ConsumerProviderAvailability;
  hasPendingAccessRequest: boolean;
  consumerAccessIds: string[];
  providerTemplateId: string | null;
  magicMcpServerId: string | null;
};

export type ConsumerProviderCatalogItem =
  | (ConsumerProviderCatalogBase & {
      type: 'provider_template';
      providerTemplate: ProviderTemplate;
    })
  | (ConsumerProviderCatalogBase & {
      type: 'magic_mcp_server';
      magicMcpServer: ConsumerMagicMcpCatalogServer;
    });

export type ConsumerProviderCatalogEntry =
  | (Extract<
      ConsumerProviderCatalogItem,
      {
        type: 'provider_template';
      }
    > & {
      deployment: ConsumerProviderDeployment;
      provider: ConsumerProvider;
      configSchema: ConsumerProviderConfigSchema | null;
      authMethods: ConsumerProviderAuthMethodList;
    })
  | Extract<
      ConsumerProviderCatalogItem,
      {
        type: 'magic_mcp_server';
      }
    >;

export type ConsumerProviderTemplateCatalogEntry = Extract<
  ConsumerProviderCatalogEntry,
  {
    type: 'provider_template';
  }
>;

type ConsumerCatalogDirection = 'after' | 'before';

type ConsumerCatalogBoundary = {
  id: string;
  sortName: string;
};

type ConsumerCatalogRecordPage = {
  items: ConsumerCatalogRecord[];
  hasMore: boolean;
};

type ConsumerProviderAvailabilityState = {
  protectedOids: Set<bigint>;
  accessibleOids: Set<bigint> | null;
};

type ConsumerCatalogSearchMatches = {
  providerTemplateIds?: string[];
  magicMcpServerIds?: string[];
};

let getCatalogSortName = (d: { name?: string | null; fallbackId: string }) => {
  return d.name?.trim() || d.fallbackId;
};

let getCatalogComparisonOperator = (d: {
  direction: ConsumerCatalogDirection;
  order: 'asc' | 'desc';
}) => {
  if (d.direction == 'after') {
    return d.order == 'asc' ? 'gt' : 'lt';
  }

  return d.order == 'asc' ? 'lt' : 'gt';
};

let reverseCatalogOrder = (order: 'asc' | 'desc') => {
  return order == 'asc' ? 'desc' : 'asc';
};

let buildNamedCatalogBoundaryFilter = (d: {
  boundary?: ConsumerCatalogBoundary | null;
  direction: ConsumerCatalogDirection;
  order: 'asc' | 'desc';
}): Prisma.ConsumerAccessListingWhereInput | undefined => {
  if (!d.boundary) {
    return undefined;
  }

  let operator = getCatalogComparisonOperator(d);

  return {
    OR: [
      {
        name: {
          [operator]: d.boundary.sortName
        }
      },
      {
        name: d.boundary.sortName,
        id: {
          [operator]: d.boundary.id
        }
      }
    ]
  };
};

let getConsumerProviderAvailability = (d: {
  oid: bigint;
  availabilityState: ConsumerProviderAvailabilityState;
}): ConsumerProviderAvailability => {
  if (d.availabilityState.accessibleOids) {
    return d.availabilityState.accessibleOids.has(d.oid) ? 'available_now' : 'request_access';
  }

  if (!d.availabilityState.protectedOids.has(d.oid)) {
    return 'available_now';
  }

  return 'request_access';
};

class ConsumerProviderCatalogServiceImpl {
  async listCatalogEntries(d: {
    instance: Instance;
    consumerSurface: Pick<ConsumerSurface, 'oid'>;
    consumerGroups: Pick<ConsumerGroup, 'oid'>[];
    consumerProfile?: Pick<ConsumerProfile, 'oid'>;
    search?: string;
    providerGroupId?: string;
    accessTags?: AnyAccessTagSelector;
    includeCapabilities?: boolean;
    pagination?: ConsumerCatalogListInput;
  }) {
    return await Paginator.create<ConsumerProviderCatalogEntry>(
      () => async input => {
        let recordPage = await this.listCatalogPage({
          instance: d.instance,
          consumerSurface: d.consumerSurface,
          consumerGroups: d.consumerGroups,
          search: d.search,
          providerGroupId: d.providerGroupId,
          pagination: input
        });

        return {
          items: await this.hydrateCatalogEntries({
            instance: d.instance,
            consumerProfile: d.consumerProfile,
            records: recordPage.items,
            includeCapabilities: d.includeCapabilities,
            accessTags: d.accessTags
          }),
          pagination: recordPage.pagination
        };
      },
      {
        defaultLimit: 50,
        defaultOrder: 'asc'
      }
    ).run(d.pagination ?? {});
  }

  async listFeaturedCatalogItems(d: {
    instance: Instance;
    consumerSurface: Pick<ConsumerSurface, 'oid'>;
    consumerGroups: Pick<ConsumerGroup, 'oid'>[];
    consumerProfile?: Pick<ConsumerProfile, 'oid'>;
    accessTags?: AnyAccessTagSelector;
    limit?: number;
  }) {
    let recordPage = await this.listCatalogPage({
      instance: d.instance,
      consumerSurface: d.consumerSurface,
      consumerGroups: d.consumerGroups,
      pagination: {
        limit: d.limit ?? 6,
        order: 'asc'
      }
    });

    return await this.hydrateCatalogItems({
      records: recordPage.items,
      consumerProfile: d.consumerProfile,
      accessTags: d.accessTags
    });
  }

  async getCatalogItem(d: {
    instance: Instance;
    consumerSurface: Pick<ConsumerSurface, 'oid'>;
    consumerGroups: Pick<ConsumerGroup, 'oid'>[];
    consumerProfile?: Pick<ConsumerProfile, 'oid'>;
    catalogItemId: string;
    accessTags?: AnyAccessTagSelector;
  }): Promise<ConsumerProviderCatalogItem> {
    let record = await this.findCatalogRecord({
      consumerSurface: d.consumerSurface,
      consumerGroups: d.consumerGroups,
      catalogItemId: d.catalogItemId
    });

    if (!record) {
      throw new ServiceError(notFoundError('consumer.provider'));
    }

    return (
      await this.hydrateCatalogItems({
        records: [record],
        consumerProfile: d.consumerProfile,
        accessTags: d.accessTags
      })
    )[0];
  }

  async getCatalogEntry(d: {
    instance: Instance;
    consumerSurface: Pick<ConsumerSurface, 'oid'>;
    consumerGroups: Pick<ConsumerGroup, 'oid'>[];
    consumerProfile?: Pick<ConsumerProfile, 'oid'>;
    catalogItemId: string;
    accessTags?: AnyAccessTagSelector;
    includeCapabilities?: boolean;
  }): Promise<ConsumerProviderCatalogEntry> {
    let record = await this.findCatalogRecord({
      consumerSurface: d.consumerSurface,
      consumerGroups: d.consumerGroups,
      catalogItemId: d.catalogItemId
    });

    if (!record) {
      throw new ServiceError(notFoundError('consumer.provider'));
    }

    return (
      await this.hydrateCatalogEntries({
        instance: d.instance,
        consumerProfile: d.consumerProfile,
        records: [record],
        includeCapabilities: d.includeCapabilities,
        accessTags: d.accessTags
      })
    )[0];
  }

  private async listCatalogPage(d: {
    instance: Instance;
    consumerSurface: Pick<ConsumerSurface, 'oid'>;
    consumerGroups: Pick<ConsumerGroup, 'oid'>[];
    search?: string;
    providerGroupId?: string;
    pagination: ConsumerCatalogListInput;
  }) {
    let limit =
      typeof d.pagination.limit == 'number'
        ? d.pagination.limit
        : Number(d.pagination.limit ?? 50);
    let order: 'asc' | 'desc' = d.pagination.order == 'desc' ? 'desc' : 'asc';
    let direction: ConsumerCatalogDirection = d.pagination.before ? 'before' : 'after';
    let boundaryId = d.pagination.before ?? d.pagination.cursor ?? d.pagination.after;
    let boundary =
      boundaryId != undefined
        ? await this.findCatalogBoundary({
            consumerSurface: d.consumerSurface,
            consumerGroups: d.consumerGroups,
            catalogItemId: String(boundaryId)
          })
        : null;
    let records = await this.listCatalogRecords({
      instance: d.instance,
      consumerSurface: d.consumerSurface,
      consumerGroups: d.consumerGroups,
      search: d.search,
      providerGroupId: d.providerGroupId,
      limit,
      direction,
      order,
      boundary
    });
    let items = records.items.slice(0, limit);

    if (direction == 'before') {
      items.reverse();
    }

    return {
      items,
      pagination: {
        hasNextPage: direction == 'before' ? !!boundary : records.hasMore,
        hasPreviousPage: direction == 'before' ? records.hasMore : !!boundary
      }
    };
  }

  private async listCatalogRecords(d: {
    instance: Instance;
    consumerSurface: Pick<ConsumerSurface, 'oid'>;
    consumerGroups: Pick<ConsumerGroup, 'oid'>[];
    search?: string;
    providerGroupId?: string;
    limit: number;
    direction: ConsumerCatalogDirection;
    order: 'asc' | 'desc';
    boundary?: ConsumerCatalogBoundary | null;
  }): Promise<ConsumerCatalogRecordPage> {
    let queryOrder = d.direction == 'before' ? reverseCatalogOrder(d.order) : d.order;
    let groupOids = d.consumerGroups.map(group => group.oid);
    let search = d.search?.trim();
    let searchMatches = await this.resolveCatalogSearchMatches({
      instance: d.instance,
      search
    });
    let boundaryFilter = buildNamedCatalogBoundaryFilter(d);
    let searchFilters: Prisma.ConsumerAccessListingWhereInput[] = [];

    if (search) {
      searchFilters.push(
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
        },
        {
          readme: {
            contains: search,
            mode: 'insensitive'
          }
        },
        {
          providerTemplate: {
            id: {
              in: searchMatches.providerTemplateIds ?? []
            }
          }
        },
        {
          magicMcpServer: {
            id: {
              in: searchMatches.magicMcpServerIds ?? []
            }
          }
        }
      );
    }

    let filters: Prisma.ConsumerAccessListingWhereInput[] = [];

    if (d.providerGroupId) {
      filters.push({
        consumerSurfaceProviderGroups: {
          some: {
            consumerSurfaceProviderGroup: {
              id: d.providerGroupId,
              consumerSurfaceOid: d.consumerSurface.oid
            }
          }
        }
      });
    }

    if (boundaryFilter) {
      filters.push(boundaryFilter);
    }

    if (searchFilters.length) {
      filters.push({
        OR: searchFilters
      });
    }

    let listings = (await db.consumerAccessListing.findMany({
      where: {
        surfaceOid: d.consumerSurface.oid,
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
          }
        ],
        AND: filters
      },
      include: this.getCatalogInclude(groupOids),
      orderBy: [{ name: queryOrder }, { id: queryOrder }],
      take: d.limit + 1
    })) as ConsumerCatalogRecord[];

    return {
      items: listings.slice(0, d.limit),
      hasMore: listings.length > d.limit
    };
  }

  private async resolveCatalogSearchMatches(d: {
    instance: Instance;
    search?: string;
  }): Promise<ConsumerCatalogSearchMatches> {
    let search = d.search?.trim();
    if (!search) {
      return {};
    }

    let [providerTemplateIds, magicMcpServerIds] = await Promise.all([
      searchProviderTemplateIds({
        instanceId: d.instance.id,
        query: search
      }),
      searchMagicMcpServerIds({
        instanceId: d.instance.id,
        query: search
      })
    ]);

    return {
      providerTemplateIds,
      magicMcpServerIds
    };
  }

  private async hydrateCatalogItems(d: {
    records: ConsumerCatalogRecord[];
    consumerProfile?: Pick<ConsumerProfile, 'oid'>;
    accessTags?: AnyAccessTagSelector;
  }): Promise<ConsumerProviderCatalogItem[]> {
    if (!d.records.length) {
      return [];
    }

    let providerTemplateRecords = d.records.filter(
      (record): record is ConsumerCatalogRecord & { providerTemplate: ProviderTemplate } => {
        return !!record.providerTemplate;
      }
    );
    let magicMcpServerRecords = d.records.filter(
      (
        record
      ): record is ConsumerCatalogRecord & {
        magicMcpServer: ConsumerMagicMcpCatalogServer;
      } => {
        return !!record.magicMcpServer;
      }
    );

    let [providerItems, magicMcpServerItems] = await Promise.all([
      this.hydrateProviderTemplateItems({
        records: providerTemplateRecords,
        consumerProfile: d.consumerProfile,
        accessTags: d.accessTags
      }),
      this.hydrateMagicMcpServerItems({
        records: magicMcpServerRecords,
        consumerProfile: d.consumerProfile,
        accessTags: d.accessTags
      })
    ]);

    let itemsById = new Map<string, ConsumerProviderCatalogItem>();

    for (let item of providerItems) {
      itemsById.set(item.id, item);
    }
    for (let item of magicMcpServerItems) {
      itemsById.set(item.id, item);
    }

    return d.records.map(record => {
      let item = itemsById.get(record.id);
      if (!item) {
        throw new Error(`Missing catalog item for ${record.id}`);
      }

      return item;
    });
  }

  private async hydrateCatalogEntries(d: {
    instance: Instance;
    records: ConsumerCatalogRecord[];
    consumerProfile?: Pick<ConsumerProfile, 'oid'>;
    includeCapabilities?: boolean;
    accessTags?: AnyAccessTagSelector;
  }): Promise<ConsumerProviderCatalogEntry[]> {
    if (!d.records.length) {
      return [];
    }

    let providerTemplateRecords = d.records.filter(
      (record): record is ConsumerCatalogRecord & { providerTemplate: ProviderTemplate } => {
        return !!record.providerTemplate;
      }
    );
    let magicMcpServerRecords = d.records.filter(
      (
        record
      ): record is ConsumerCatalogRecord & {
        magicMcpServer: ConsumerMagicMcpCatalogServer;
      } => {
        return !!record.magicMcpServer;
      }
    );

    let [providerEntries, magicMcpServerEntries] = await Promise.all([
      this.hydrateProviderTemplateEntries({
        instance: d.instance,
        records: providerTemplateRecords,
        consumerProfile: d.consumerProfile,
        includeCapabilities: d.includeCapabilities,
        accessTags: d.accessTags
      }),
      this.hydrateMagicMcpServerEntries({
        records: magicMcpServerRecords,
        consumerProfile: d.consumerProfile,
        accessTags: d.accessTags
      })
    ]);

    let entriesById = new Map<string, ConsumerProviderCatalogEntry>();

    for (let entry of providerEntries) {
      entriesById.set(entry.id, entry);
    }
    for (let entry of magicMcpServerEntries) {
      entriesById.set(entry.id, entry);
    }

    return d.records.map(record => {
      let entry = entriesById.get(record.id);
      if (!entry) {
        throw new Error(`Missing hydrated catalog entry for ${record.id}`);
      }

      return entry;
    });
  }

  private async hydrateProviderTemplateItems(d: {
    records: (ConsumerCatalogRecord & { providerTemplate: ProviderTemplate })[];
    consumerProfile?: Pick<ConsumerProfile, 'oid'>;
    accessTags?: AnyAccessTagSelector;
  }): Promise<
    Extract<
      ConsumerProviderCatalogItem,
      {
        type: 'provider_template';
      }
    >[]
  > {
    if (!d.records.length) {
      return [];
    }

    let providerTemplates = d.records.map(record => record.providerTemplate);
    let availabilityState = await this.getProviderTemplateAvailabilityState({
      providerTemplates,
      accessTags: d.accessTags
    });
    let pendingAccessRequestState = await this.getPendingAccessRequestState({
      consumerProfile: d.consumerProfile,
      providerTemplates
    });

    return d.records.map(record => {
      let providerTemplate = record.providerTemplate;
      let hasConsumerAccess = record.consumerAccesses.length > 0;

      return {
        id: record.id,
        listing: record,
        name: this.getCatalogRecordName(record),
        description: this.getCatalogRecordDescription(record),
        readme: record.readme ?? null,
        availability: hasConsumerAccess
          ? getConsumerProviderAvailability({
              oid: providerTemplate.oid,
              availabilityState
            })
          : 'request_access',
        hasPendingAccessRequest: pendingAccessRequestState.providerTemplateOids.has(
          providerTemplate.oid
        ),
        consumerAccessIds: record.consumerAccesses.map(consumerAccess => consumerAccess.id),
        providerTemplateId: providerTemplate.id,
        magicMcpServerId: null,
        type: 'provider_template' as const,
        providerTemplate
      };
    });
  }

  private async hydrateProviderTemplateEntries(d: {
    instance: Instance;
    records: (ConsumerCatalogRecord & { providerTemplate: ProviderTemplate })[];
    consumerProfile?: Pick<ConsumerProfile, 'oid'>;
    includeCapabilities?: boolean;
    accessTags?: AnyAccessTagSelector;
  }): Promise<ConsumerProviderTemplateCatalogEntry[]> {
    if (!d.records.length) {
      return [];
    }

    let providerTemplates = d.records.map(record => record.providerTemplate);
    let availabilityState = await this.getProviderTemplateAvailabilityState({
      providerTemplates,
      accessTags: d.accessTags
    });
    let pendingAccessRequestState = await this.getPendingAccessRequestState({
      consumerProfile: d.consumerProfile,
      providerTemplates
    });

    let backings = await subspaceMagicMcpBackingService.getManyProviderTemplates({
      instance: d.instance,
      providerTemplateBackingIds: providerTemplates.map(
        providerTemplate => providerTemplate.id
      )
    });
    let backingMap = new Map(backings.map(backing => [backing.id, backing]));
    let primaryProviderEntries: [string, (typeof backings)[number]['providers'][number]][] =
      [];
    for (let backing of backings) {
      let provider = backing.providers[0];
      if (provider) {
        primaryProviderEntries.push([backing.id, provider]);
      }
    }
    let primaryProviderByTemplateId = new Map(primaryProviderEntries);

    let deploymentIds = Array.from(
      new Set(
        Array.from(primaryProviderByTemplateId.values()).map(provider => {
          return provider.deployment.id;
        })
      )
    );
    let deployments = await Promise.all(
      deploymentIds.map(async providerDeploymentId => {
        return [
          providerDeploymentId,
          await subspaceProviderDeploymentService.get({
            instance: d.instance,
            providerDeploymentId
          })
        ] as const;
      })
    );
    let deploymentMap = new Map(deployments);

    let providerIds = Array.from(
      new Set(deployments.map(([, deployment]) => deployment.providerId))
    );
    let providers = await Promise.all(
      providerIds.map(async providerId => {
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

    let capabilityMap = new Map<
      string,
      {
        configSchema: ConsumerProviderConfigSchema | null;
        authMethods: ConsumerProviderAuthMethodList;
      }
    >();

    if (d.includeCapabilities) {
      let accessibleProviderTemplateIds = new Set<string>();
      let oidsWithConsumerAccess = new Set(
        d.records
          .filter(record => record.consumerAccesses.length > 0)
          .map(record => record.providerTemplate.oid)
      );

      for (let providerTemplate of providerTemplates) {
        if (
          oidsWithConsumerAccess.has(providerTemplate.oid) &&
          getConsumerProviderAvailability({
            oid: providerTemplate.oid,
            availabilityState
          }) == 'available_now'
        ) {
          accessibleProviderTemplateIds.add(providerTemplate.id);
        }
      }

      await Promise.all(
        Array.from(accessibleProviderTemplateIds).map(async providerTemplateId => {
          let primaryProvider = primaryProviderByTemplateId.get(providerTemplateId);
          if (!primaryProvider) {
            throw new ServiceError(notFoundError('provider.template'));
          }
          let providerDeploymentId = primaryProvider.deployment.id;
          let deployment = deploymentMap.get(providerDeploymentId);
          if (!deployment) {
            throw new ServiceError(notFoundError('provider.deployment'));
          }
          let provider = providerMap.get(deployment.providerId);
          if (!provider) {
            throw new ServiceError(notFoundError('provider'));
          }

          let [configSchema, authMethods] = await Promise.all([
            subspaceProviderConfigService.getConfigSchema({
              instance: d.instance,
              providerDeploymentId
            }),
            listProviderAuthMethods({
              instance: d.instance,
              providerVersionId: getProviderVersionIdForAuthMethods({
                deployment,
                provider
              })
            })
          ]);

          capabilityMap.set(providerTemplateId, {
            configSchema,
            authMethods
          });
        })
      );
    }

    return d.records.map(record => {
      let providerTemplate = record.providerTemplate;
      let backing = backingMap.get(providerTemplate.id);
      if (!backing) {
        throw new ServiceError(notFoundError('provider.template'));
      }

      let primaryProvider = primaryProviderByTemplateId.get(providerTemplate.id);
      if (!primaryProvider) {
        throw new ServiceError(notFoundError('provider'));
      }

      let deployment = deploymentMap.get(primaryProvider.deployment.id);
      if (!deployment) {
        throw new ServiceError(notFoundError('provider.deployment'));
      }

      let provider = providerMap.get(deployment.providerId);
      if (!provider) {
        throw new ServiceError(notFoundError('provider'));
      }

      let hasConsumerAccess = record.consumerAccesses.length > 0;
      let availability: ConsumerProviderAvailability = hasConsumerAccess
        ? getConsumerProviderAvailability({
            oid: providerTemplate.oid,
            availabilityState
          })
        : 'request_access';
      let capabilities = capabilityMap.get(providerTemplate.id);

      return {
        id: record.id,
        listing: record,
        name: this.getCatalogRecordName(record),
        description: this.getCatalogRecordDescription(record),
        readme: record.readme ?? null,
        availability,
        hasPendingAccessRequest: pendingAccessRequestState.providerTemplateOids.has(
          providerTemplate.oid
        ),
        consumerAccessIds: record.consumerAccesses.map(consumerAccess => consumerAccess.id),
        providerTemplateId: providerTemplate.id,
        magicMcpServerId: null,
        type: 'provider_template' as const,
        providerTemplate,
        deployment,
        provider,
        configSchema:
          availability == 'available_now' ? (capabilities?.configSchema ?? null) : null,
        authMethods: availability == 'available_now' ? (capabilities?.authMethods ?? []) : []
      };
    });
  }

  private async hydrateMagicMcpServerItems(d: {
    records: (ConsumerCatalogRecord & { magicMcpServer: ConsumerMagicMcpCatalogServer })[];
    consumerProfile?: Pick<ConsumerProfile, 'oid'>;
    accessTags?: AnyAccessTagSelector;
  }): Promise<
    Extract<
      ConsumerProviderCatalogItem,
      {
        type: 'magic_mcp_server';
      }
    >[]
  > {
    if (!d.records.length) {
      return [];
    }

    let magicMcpServers = d.records.map(record => record.magicMcpServer);
    let availabilityState = await this.getMagicMcpServerAvailabilityState({
      magicMcpServers,
      accessTags: d.accessTags
    });
    let pendingAccessRequestState = await this.getPendingAccessRequestState({
      consumerProfile: d.consumerProfile,
      magicMcpServers
    });

    return d.records.map(record => {
      let magicMcpServer = record.magicMcpServer;
      let hasConsumerAccess = record.consumerAccesses.length > 0;

      return {
        id: record.id,
        listing: record,
        name: this.getCatalogRecordName(record),
        description: this.getCatalogRecordDescription(record),
        readme: record.readme ?? null,
        availability: hasConsumerAccess
          ? getConsumerProviderAvailability({
              oid: magicMcpServer.oid,
              availabilityState
            })
          : 'request_access',
        hasPendingAccessRequest: pendingAccessRequestState.magicMcpServerOids.has(
          magicMcpServer.oid
        ),
        consumerAccessIds: record.consumerAccesses.map(consumerAccess => consumerAccess.id),
        providerTemplateId: null,
        magicMcpServerId: magicMcpServer.id,
        type: 'magic_mcp_server' as const,
        magicMcpServer
      };
    });
  }

  private async hydrateMagicMcpServerEntries(d: {
    records: (ConsumerCatalogRecord & { magicMcpServer: ConsumerMagicMcpCatalogServer })[];
    consumerProfile?: Pick<ConsumerProfile, 'oid'>;
    accessTags?: AnyAccessTagSelector;
  }): Promise<
    Extract<
      ConsumerProviderCatalogEntry,
      {
        type: 'magic_mcp_server';
      }
    >[]
  > {
    return await this.hydrateMagicMcpServerItems(d);
  }

  private async getPendingAccessRequestState(d: {
    consumerProfile?: Pick<ConsumerProfile, 'oid'>;
    providerTemplates?: ProviderTemplate[];
    magicMcpServers?: ConsumerMagicMcpCatalogServer[];
  }) {
    if (!d.consumerProfile) {
      return {
        providerTemplateOids: new Set<bigint>(),
        magicMcpServerOids: new Set<bigint>()
      };
    }

    let providerTemplateOids =
      d.providerTemplates?.map(providerTemplate => providerTemplate.oid) ?? [];
    let magicMcpServerOids =
      d.magicMcpServers?.map(magicMcpServer => magicMcpServer.oid) ?? [];

    if (!providerTemplateOids.length && !magicMcpServerOids.length) {
      return {
        providerTemplateOids: new Set<bigint>(),
        magicMcpServerOids: new Set<bigint>()
      };
    }

    let pendingAccessRequests = await db.consumerAccessRequest.findMany({
      where: {
        consumerProfileOid: d.consumerProfile.oid,
        status: 'pending',
        OR: [
          providerTemplateOids.length
            ? {
                providerTemplateOid: {
                  in: providerTemplateOids
                }
              }
            : undefined!,
          magicMcpServerOids.length
            ? {
                magicMcpServerOid: {
                  in: magicMcpServerOids
                }
              }
            : undefined!
        ].filter(Boolean)
      },
      select: {
        providerTemplateOid: true,
        magicMcpServerOid: true
      }
    });

    return {
      providerTemplateOids: new Set(
        pendingAccessRequests
          .map(accessRequest => accessRequest.providerTemplateOid)
          .filter((oid): oid is bigint => oid != null)
      ),
      magicMcpServerOids: new Set(
        pendingAccessRequests
          .map(accessRequest => accessRequest.magicMcpServerOid)
          .filter((oid): oid is bigint => oid != null)
      )
    };
  }

  private async getProviderTemplateAvailabilityState(d: {
    providerTemplates: ProviderTemplate[];
    accessTags?: AnyAccessTagSelector;
  }): Promise<ConsumerProviderAvailabilityState> {
    if (!d.providerTemplates.length) {
      return {
        protectedOids: new Set(),
        accessibleOids: d.accessTags ? new Set() : null
      };
    }

    let oids = d.providerTemplates.map(providerTemplate => providerTemplate.oid);
    let protectedOids = new Set(
      (
        await db.providerTemplate.findMany({
          where: {
            oid: {
              in: oids
            },
            accessTagEntities: {
              some: {
                accessTagPolicy: {
                  roles: {
                    hasSome: [...consumerProviderTemplateReadRoles]
                  }
                }
              }
            }
          },
          select: {
            oid: true
          }
        })
      ).map(providerTemplate => providerTemplate.oid)
    );

    if (!d.accessTags) {
      return {
        protectedOids,
        accessibleOids: null
      };
    }

    let accessTagFilter = await accessTagService.getAccessTagFilter({
      tags: d.accessTags,
      roles: [...consumerProviderTemplateReadRoles]
    });

    let accessibleOids = new Set(
      (
        await db.providerTemplate.findMany({
          where: {
            oid: {
              in: oids
            },
            accessTagEntities: accessTagFilter as never
          },
          select: {
            oid: true
          }
        })
      ).map(providerTemplate => providerTemplate.oid)
    );

    return {
      protectedOids,
      accessibleOids
    };
  }

  private async getMagicMcpServerAvailabilityState(d: {
    magicMcpServers: ConsumerMagicMcpCatalogServer[];
    accessTags?: AnyAccessTagSelector;
  }): Promise<ConsumerProviderAvailabilityState> {
    if (!d.magicMcpServers.length) {
      return {
        protectedOids: new Set(),
        accessibleOids: d.accessTags ? new Set() : null
      };
    }

    let oids = d.magicMcpServers.map(magicMcpServer => magicMcpServer.oid);
    let protectedOids = new Set(
      (
        await db.magicMcpServer.findMany({
          where: {
            oid: {
              in: oids
            },
            accessTagEntities: {
              some: {
                accessTagPolicy: {
                  roles: {
                    hasSome: [...consumerMagicMcpReadRoles]
                  }
                }
              }
            }
          },
          select: {
            oid: true
          }
        })
      ).map(magicMcpServer => magicMcpServer.oid)
    );

    if (!d.accessTags) {
      return {
        protectedOids,
        accessibleOids: null
      };
    }

    let accessTagFilter = await accessTagService.getAccessTagFilter({
      tags: d.accessTags,
      roles: [...consumerMagicMcpReadRoles]
    });
    let accessibleOids = new Set(
      (
        await db.magicMcpServer.findMany({
          where: {
            oid: {
              in: oids
            },
            accessTagEntities: accessTagFilter as never
          },
          select: {
            oid: true
          }
        })
      ).map(magicMcpServer => magicMcpServer.oid)
    );

    return {
      protectedOids,
      accessibleOids
    };
  }

  private async findCatalogBoundary(d: {
    consumerSurface: Pick<ConsumerSurface, 'oid'>;
    consumerGroups: Pick<ConsumerGroup, 'oid'>[];
    catalogItemId: string;
  }): Promise<ConsumerCatalogBoundary | null> {
    let record = await this.findCatalogRecord(d);
    if (!record) {
      return null;
    }

    return {
      id: record.id,
      sortName: getCatalogSortName({
        name: record.name,
        fallbackId: record.id
      })
    };
  }

  private async findCatalogRecord(d: {
    consumerSurface: Pick<ConsumerSurface, 'oid'>;
    consumerGroups: Pick<ConsumerGroup, 'oid'>[];
    catalogItemId: string;
  }): Promise<ConsumerCatalogRecord | null> {
    let groupOids = d.consumerGroups.map(group => group.oid);

    return await db.consumerAccessListing.findFirst({
      where: {
        surfaceOid: d.consumerSurface.oid,
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
          }
        ],
        AND: [
          {
            OR: [
              {
                id: d.catalogItemId
              },
              {
                consumerAccesses: {
                  some: {
                    id: d.catalogItemId
                  }
                }
              },
              {
                providerTemplate: {
                  id: d.catalogItemId
                }
              },
              {
                magicMcpServer: {
                  id: d.catalogItemId
                }
              }
            ]
          }
        ]
      },
      include: this.getCatalogInclude(groupOids)
    });
  }

  private getCatalogInclude(groupOids: bigint[]) {
    return {
      providerTemplate: true,
      magicMcpServer: {
        include: magicMcpCatalogInclude
      },
      consumerAccesses: {
        where: {
          consumerGroupOid: {
            in: groupOids
          }
        },
        select: {
          id: true
        }
      }
    };
  }

  private getCatalogRecordName(record: ConsumerCatalogRecord) {
    return (
      record.name.trim() ||
      (record.providerTemplate
        ? record.providerTemplate.name
        : (record.magicMcpServer?.name ?? record.magicMcpServer?.id ?? record.id))
    );
  }

  private getCatalogRecordDescription(record: ConsumerCatalogRecord) {
    return (
      record.description ??
      (record.providerTemplate
        ? record.providerTemplate.description
        : (record.magicMcpServer?.description ?? null))
    );
  }
}

export let consumerProviderCatalogService = Service.create(
  'consumerProviderCatalogService',
  () => new ConsumerProviderCatalogServiceImpl()
).build();
