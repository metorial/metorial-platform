import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator, type PaginatorInput } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { ConsumerProfile, db, Prisma, ProviderTemplate, type Instance } from '@metorial/db';
import {
  accessTagService,
  consumerMagicMcpReadRoles,
  consumerProviderTemplateReadRoles,
  type AnyAccessTagSelector
} from '@metorial/module-access';
import { searchMagicMcpServerIds, searchProviderTemplateIds } from '@metorial/module-search';
import {
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
} from './consumerProviderContext';
import { isPreconfiguredMagicMcpServer } from './magicMcpServerSource';

export type ConsumerProviderAvailability = 'available_now' | 'request_access';

export type ConsumerCatalogListInput = PaginatorInput;

let magicMcpCatalogInclude = {
  aliases: true,
  subspaceSession: true
} as const;

type ConsumerMagicMcpCatalogServer = Prisma.MagicMcpServerGetPayload<{
  include: typeof magicMcpCatalogInclude;
}>;

export type ConsumerProviderCatalogItem =
  | {
      type: 'provider_template';
      availability: ConsumerProviderAvailability;
      hasPendingAccessRequest: boolean;
      providerTemplate: ProviderTemplate;
    }
  | {
      type: 'magic_mcp_server';
      availability: ConsumerProviderAvailability;
      hasPendingAccessRequest: boolean;
      magicMcpServer: ConsumerMagicMcpCatalogServer;
    };

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

type ConsumerCatalogRecord =
  | {
      type: 'provider_template';
      id: string;
      sortName: string;
      providerTemplate: ProviderTemplate;
    }
  | {
      type: 'magic_mcp_server';
      id: string;
      sortName: string;
      magicMcpServer: ConsumerMagicMcpCatalogServer;
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

let getCatalogEntryId = (
  entry: ConsumerProviderCatalogItem | ConsumerProviderCatalogEntry | ConsumerCatalogRecord
) => {
  return entry.type == 'provider_template'
    ? entry.providerTemplate.id
    : entry.magicMcpServer.id;
};

let getCatalogEntryName = (
  entry: ConsumerProviderCatalogItem | ConsumerProviderCatalogEntry | ConsumerCatalogRecord
) => {
  if (entry.type == 'provider_template') {
    return entry.providerTemplate.name.trim() || entry.providerTemplate.id;
  }

  return entry.magicMcpServer.name?.trim() || entry.magicMcpServer.id;
};

let compareCatalogRecords = (
  left: ConsumerCatalogRecord,
  right: ConsumerCatalogRecord,
  order: 'asc' | 'desc'
) => {
  let nameCompare = getCatalogEntryName(left).localeCompare(getCatalogEntryName(right));
  if (nameCompare != 0) {
    return order == 'asc' ? nameCompare : -nameCompare;
  }

  let idCompare = getCatalogEntryId(left).localeCompare(getCatalogEntryId(right));
  return order == 'asc' ? idCompare : -idCompare;
};

let getCatalogRecordKey = (record: ConsumerCatalogRecord) => {
  return `${record.type}:${record.id}`;
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

let shouldIncludeUnnamedMagicMcpBoundaryId = (d: {
  boundary: ConsumerCatalogBoundary;
  direction: ConsumerCatalogDirection;
  order: 'asc' | 'desc';
}) => {
  let comparison = d.boundary.sortName.localeCompare(d.boundary.id);
  if (d.direction == 'after') {
    return d.order == 'asc' ? comparison > 0 : comparison < 0;
  }

  return d.order == 'asc' ? comparison < 0 : comparison > 0;
};

let buildNamedCatalogBoundaryFilter = (d: {
  boundary?: ConsumerCatalogBoundary | null;
  direction: ConsumerCatalogDirection;
  order: 'asc' | 'desc';
}) => {
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

let buildUnnamedMagicMcpBoundaryFilter = (d: {
  boundary?: ConsumerCatalogBoundary | null;
  direction: ConsumerCatalogDirection;
  order: 'asc' | 'desc';
}) => {
  let boundary = d.boundary;
  if (!boundary) {
    return undefined;
  }

  let operator = getCatalogComparisonOperator(d);

  return {
    OR: [
      {
        id: {
          [operator]: boundary.sortName
        }
      },
      ...(shouldIncludeUnnamedMagicMcpBoundaryId({
        boundary,
        direction: d.direction,
        order: d.order
      })
        ? [
            {
              id: boundary.id
            }
          ]
        : [])
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
    consumerProfile?: Pick<ConsumerProfile, 'oid'>;
    search?: string;
    accessTags?: AnyAccessTagSelector;
    includeCapabilities?: boolean;
    pagination?: ConsumerCatalogListInput;
  }) {
    return await Paginator.create<ConsumerProviderCatalogEntry>(
      () => async input => {
        let recordPage = await this.listCatalogPage({
          instance: d.instance,
          search: d.search,
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
    consumerProfile?: Pick<ConsumerProfile, 'oid'>;
    accessTags?: AnyAccessTagSelector;
    limit?: number;
  }) {
    let recordPage = await this.listCatalogPage({
      instance: d.instance,
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
    consumerProfile?: Pick<ConsumerProfile, 'oid'>;
    catalogItemId: string;
    accessTags?: AnyAccessTagSelector;
  }): Promise<ConsumerProviderCatalogItem> {
    let record = await this.findCatalogRecord({
      instance: d.instance,
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
    consumerProfile?: Pick<ConsumerProfile, 'oid'>;
    catalogItemId: string;
    accessTags?: AnyAccessTagSelector;
    includeCapabilities?: boolean;
  }): Promise<ConsumerProviderCatalogEntry> {
    let record = await this.findCatalogRecord({
      instance: d.instance,
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
    search?: string;
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
            instance: d.instance,
            catalogItemId: String(boundaryId)
          })
        : null;
    let searchMatches = await this.resolveCatalogSearchMatches({
      instance: d.instance,
      search: d.search
    });

    let [providerTemplates, magicMcpServers] = await Promise.all([
      this.listProviderTemplateRecords({
        instance: d.instance,
        searchMatches,
        limit,
        direction,
        order,
        boundary
      }),
      this.listMagicMcpServerRecords({
        instance: d.instance,
        searchMatches,
        limit,
        direction,
        order,
        boundary
      })
    ]);

    let queryOrder = direction == 'before' ? reverseCatalogOrder(order) : order;
    let records = [...providerTemplates.items, ...magicMcpServers.items].sort((left, right) =>
      compareCatalogRecords(left, right, queryOrder)
    );
    let hasMore =
      records.length > limit || providerTemplates.hasMore || magicMcpServers.hasMore;
    let items = records.slice(0, limit);

    if (direction == 'before') {
      items.reverse();
    }

    return {
      items,
      pagination: {
        hasNextPage: direction == 'before' ? !!boundary : hasMore,
        hasPreviousPage: direction == 'before' ? hasMore : !!boundary
      }
    };
  }

  private async listProviderTemplateRecords(d: {
    instance: Instance;
    searchMatches?: ConsumerCatalogSearchMatches;
    limit: number;
    direction: ConsumerCatalogDirection;
    order: 'asc' | 'desc';
    boundary?: ConsumerCatalogBoundary | null;
  }): Promise<ConsumerCatalogRecordPage> {
    let queryOrder = d.direction == 'before' ? reverseCatalogOrder(d.order) : d.order;
    let filters: Prisma.ProviderTemplateWhereInput[] = [];
    let boundaryFilter = buildNamedCatalogBoundaryFilter(d);

    if (d.searchMatches?.providerTemplateIds) {
      filters.push({
        id: {
          in: d.searchMatches.providerTemplateIds
        }
      });
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
      items: providerTemplates
        .slice(0, d.limit)
        .map(providerTemplate => this.createProviderTemplateRecord(providerTemplate)),
      hasMore: providerTemplates.length > d.limit
    };
  }

  private async listMagicMcpServerRecords(d: {
    instance: Instance;
    searchMatches?: ConsumerCatalogSearchMatches;
    limit: number;
    direction: ConsumerCatalogDirection;
    order: 'asc' | 'desc';
    boundary?: ConsumerCatalogBoundary | null;
  }): Promise<ConsumerCatalogRecordPage> {
    let [namedServers, unnamedServers] = await Promise.all([
      this.listMagicMcpServerRecordPage({
        ...d,
        nameMode: 'named'
      }),
      this.listMagicMcpServerRecordPage({
        ...d,
        nameMode: 'unnamed'
      })
    ]);

    return {
      items: [...namedServers.items, ...unnamedServers.items],
      hasMore: namedServers.hasMore || unnamedServers.hasMore
    };
  }

  private async listMagicMcpServerRecordPage(d: {
    instance: Instance;
    searchMatches?: ConsumerCatalogSearchMatches;
    limit: number;
    direction: ConsumerCatalogDirection;
    order: 'asc' | 'desc';
    boundary?: ConsumerCatalogBoundary | null;
    nameMode: 'named' | 'unnamed';
  }): Promise<ConsumerCatalogRecordPage> {
    let queryOrder = d.direction == 'before' ? reverseCatalogOrder(d.order) : d.order;
    let filters: Prisma.MagicMcpServerWhereInput[] = [
      {
        NOT: {
          source: 'consumer_provider_template'
        }
      }
    ];
    let boundaryFilter =
      d.nameMode == 'named'
        ? buildNamedCatalogBoundaryFilter(d)
        : buildUnnamedMagicMcpBoundaryFilter(d);

    if (d.searchMatches?.magicMcpServerIds) {
      filters.push({
        id: {
          in: d.searchMatches.magicMcpServerIds
        }
      });
    }
    if (boundaryFilter) {
      filters.push(boundaryFilter as Prisma.MagicMcpServerWhereInput);
    }

    let magicMcpServers = await db.magicMcpServer.findMany({
      where: {
        instanceOid: d.instance.oid,
        status: 'active',
        name: d.nameMode == 'named' ? { not: null } : null,
        AND: filters
      },
      include: magicMcpCatalogInclude,
      orderBy:
        d.nameMode == 'named'
          ? [{ name: queryOrder }, { id: queryOrder }]
          : [{ id: queryOrder }],
      take: d.limit + 1
    });

    return {
      items: magicMcpServers
        .slice(0, d.limit)
        .map(magicMcpServer => this.createMagicMcpServerRecord(magicMcpServer)),
      hasMore: magicMcpServers.length > d.limit
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
      (record): record is Extract<ConsumerCatalogRecord, { type: 'provider_template' }> => {
        return record.type == 'provider_template';
      }
    );
    let magicMcpServerRecords = d.records.filter(
      (record): record is Extract<ConsumerCatalogRecord, { type: 'magic_mcp_server' }> => {
        return record.type == 'magic_mcp_server';
      }
    );

    let [providerItems, magicMcpServerItems] = await Promise.all([
      this.hydrateProviderTemplateItems({
        providerTemplates: providerTemplateRecords.map(record => record.providerTemplate),
        consumerProfile: d.consumerProfile,
        accessTags: d.accessTags
      }),
      this.hydrateMagicMcpServerItems({
        magicMcpServers: magicMcpServerRecords.map(record => record.magicMcpServer),
        consumerProfile: d.consumerProfile,
        accessTags: d.accessTags
      })
    ]);

    let itemsByKey = new Map<string, ConsumerProviderCatalogItem>();

    for (let item of providerItems) {
      itemsByKey.set(`provider_template:${item.providerTemplate.id}`, item);
    }
    for (let item of magicMcpServerItems) {
      itemsByKey.set(`magic_mcp_server:${item.magicMcpServer.id}`, item);
    }

    return d.records.map(record => {
      let item = itemsByKey.get(getCatalogRecordKey(record));
      if (!item) {
        throw new Error(`Missing catalog item for ${getCatalogRecordKey(record)}`);
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
      (record): record is Extract<ConsumerCatalogRecord, { type: 'provider_template' }> => {
        return record.type == 'provider_template';
      }
    );
    let magicMcpServerRecords = d.records.filter(
      (record): record is Extract<ConsumerCatalogRecord, { type: 'magic_mcp_server' }> => {
        return record.type == 'magic_mcp_server';
      }
    );

    let [providerEntries, magicMcpServerEntries] = await Promise.all([
      this.hydrateProviderTemplateEntries({
        instance: d.instance,
        providerTemplates: providerTemplateRecords.map(record => record.providerTemplate),
        consumerProfile: d.consumerProfile,
        includeCapabilities: d.includeCapabilities,
        accessTags: d.accessTags
      }),
      this.hydrateMagicMcpServerEntries({
        magicMcpServers: magicMcpServerRecords.map(record => record.magicMcpServer),
        consumerProfile: d.consumerProfile,
        accessTags: d.accessTags
      })
    ]);

    let entriesByKey = new Map<string, ConsumerProviderCatalogEntry>();

    for (let entry of providerEntries) {
      entriesByKey.set(`provider_template:${entry.providerTemplate.id}`, entry);
    }
    for (let entry of magicMcpServerEntries) {
      entriesByKey.set(`magic_mcp_server:${entry.magicMcpServer.id}`, entry);
    }

    return d.records.map(record => {
      let entry = entriesByKey.get(getCatalogRecordKey(record));
      if (!entry) {
        throw new Error(`Missing hydrated catalog entry for ${getCatalogRecordKey(record)}`);
      }

      return entry;
    });
  }

  private async hydrateProviderTemplateItems(d: {
    providerTemplates: ProviderTemplate[];
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
    if (!d.providerTemplates.length) {
      return [];
    }

    let availabilityState = await this.getProviderTemplateAvailabilityState({
      providerTemplates: d.providerTemplates,
      accessTags: d.accessTags
    });
    let pendingAccessRequestState = await this.getPendingAccessRequestState({
      consumerProfile: d.consumerProfile,
      providerTemplates: d.providerTemplates
    });

    return d.providerTemplates.map(providerTemplate => {
      return {
        type: 'provider_template' as const,
        availability: getConsumerProviderAvailability({
          oid: providerTemplate.oid,
          availabilityState
        }),
        hasPendingAccessRequest: pendingAccessRequestState.providerTemplateOids.has(
          providerTemplate.oid
        ),
        providerTemplate
      };
    });
  }

  private async hydrateProviderTemplateEntries(d: {
    instance: Instance;
    providerTemplates: ProviderTemplate[];
    consumerProfile?: Pick<ConsumerProfile, 'oid'>;
    includeCapabilities?: boolean;
    accessTags?: AnyAccessTagSelector;
  }): Promise<ConsumerProviderTemplateCatalogEntry[]> {
    if (!d.providerTemplates.length) {
      return [];
    }

    let availabilityState = await this.getProviderTemplateAvailabilityState({
      providerTemplates: d.providerTemplates,
      accessTags: d.accessTags
    });
    let pendingAccessRequestState = await this.getPendingAccessRequestState({
      consumerProfile: d.consumerProfile,
      providerTemplates: d.providerTemplates
    });

    let deploymentIds = Array.from(
      new Set(
        d.providerTemplates.map(providerTemplate => providerTemplate.providerDeploymentId)
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
      let accessibleDeploymentIds = new Set<string>();

      for (let providerTemplate of d.providerTemplates) {
        if (
          getConsumerProviderAvailability({
            oid: providerTemplate.oid,
            availabilityState
          }) == 'available_now'
        ) {
          accessibleDeploymentIds.add(providerTemplate.providerDeploymentId);
        }
      }

      await Promise.all(
        Array.from(accessibleDeploymentIds).map(async providerDeploymentId => {
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

          capabilityMap.set(providerDeploymentId, {
            configSchema,
            authMethods
          });
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

      let availability = getConsumerProviderAvailability({
        oid: providerTemplate.oid,
        availabilityState
      });
      let capabilities = capabilityMap.get(providerTemplate.providerDeploymentId);

      return {
        type: 'provider_template' as const,
        availability,
        hasPendingAccessRequest: pendingAccessRequestState.providerTemplateOids.has(
          providerTemplate.oid
        ),
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
    magicMcpServers: ConsumerMagicMcpCatalogServer[];
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
    if (!d.magicMcpServers.length) {
      return [];
    }

    let availabilityState = await this.getMagicMcpServerAvailabilityState({
      magicMcpServers: d.magicMcpServers,
      accessTags: d.accessTags
    });
    let pendingAccessRequestState = await this.getPendingAccessRequestState({
      consumerProfile: d.consumerProfile,
      magicMcpServers: d.magicMcpServers
    });

    return d.magicMcpServers.map(magicMcpServer => {
      return {
        type: 'magic_mcp_server' as const,
        availability: getConsumerProviderAvailability({
          oid: magicMcpServer.oid,
          availabilityState
        }),
        hasPendingAccessRequest: pendingAccessRequestState.magicMcpServerOids.has(
          magicMcpServer.oid
        ),
        magicMcpServer
      };
    });
  }

  private async hydrateMagicMcpServerEntries(d: {
    magicMcpServers: ConsumerMagicMcpCatalogServer[];
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
    instance: Instance;
    catalogItemId: string;
  }): Promise<ConsumerCatalogBoundary | null> {
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
        sortName: getCatalogSortName({
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
          source: 'consumer_provider_template'
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
      sortName: getCatalogSortName({
        name: magicMcpServer.name,
        fallbackId: magicMcpServer.id
      })
    };
  }

  private async findCatalogRecord(d: {
    instance: Instance;
    catalogItemId: string;
  }): Promise<ConsumerCatalogRecord | null> {
    let providerTemplate = await db.providerTemplate.findFirst({
      where: {
        instanceOid: d.instance.oid,
        id: d.catalogItemId,
        status: 'active'
      }
    });

    if (providerTemplate) {
      return this.createProviderTemplateRecord(providerTemplate);
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
      return null;
    }

    return this.createMagicMcpServerRecord(magicMcpServer);
  }

  private createProviderTemplateRecord(
    providerTemplate: ProviderTemplate
  ): ConsumerCatalogRecord {
    return {
      type: 'provider_template',
      id: providerTemplate.id,
      sortName: getCatalogSortName({
        name: providerTemplate.name,
        fallbackId: providerTemplate.id
      }),
      providerTemplate
    };
  }

  private createMagicMcpServerRecord(
    magicMcpServer: ConsumerMagicMcpCatalogServer
  ): ConsumerCatalogRecord {
    return {
      type: 'magic_mcp_server',
      id: magicMcpServer.id,
      sortName: getCatalogSortName({
        name: magicMcpServer.name,
        fallbackId: magicMcpServer.id
      }),
      magicMcpServer
    };
  }
}

export let consumerProviderCatalogService = Service.create(
  'consumerProviderCatalogService',
  () => new ConsumerProviderCatalogServiceImpl()
).build();
