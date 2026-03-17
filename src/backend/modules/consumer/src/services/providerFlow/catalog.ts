import { Paginator } from '@lowerdeck/pagination';
import { notFoundError, ServiceError } from '@lowerdeck/error';
import { db, Prisma, type Instance } from '@metorial/db';
import { type AnyAccessTagSelector } from '@metorial/module-access';
import { isPreconfiguredMagicMcpServer } from '../magicMcpServerSource';
import {
  compareCatalogEntries,
  getCatalogBoundaryComparisonOperator,
  getCatalogComparableName,
  getCatalogEntryId,
  getReverseCatalogOrder,
  shouldIncludeUnnamedMagicMcpBoundaryId
} from './catalogOrdering';
import { hydrateConsumerProviders, hydratePreconfiguredMagicMcpServers } from './hydration';
import { magicMcpCatalogInclude, type ConsumerCatalogBoundary, type ConsumerCatalogListInput, type ConsumerCatalogPageDirection, type ConsumerProviderCatalogEntry } from './types';

let getCatalogBoundary = async (d: {
  instance: Instance;
  catalogItemId: string;
}) => {
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
    name: getCatalogComparableName({
      name: magicMcpServer.name,
      fallbackId: magicMcpServer.id
    })
  };
};

let buildNameDescriptionSearchFilter = (search?: string) => {
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
};

let buildNamedCatalogBoundaryFilter = (d: {
  boundary?: ConsumerCatalogBoundary | null;
  direction: ConsumerCatalogPageDirection;
  order: 'asc' | 'desc';
}) => {
  if (!d.boundary) {
    return undefined;
  }

  let operator = getCatalogBoundaryComparisonOperator(d);

  return {
    OR: [
      {
        name: {
          [operator]: d.boundary.name
        }
      },
      {
        name: d.boundary.name,
        id: {
          [operator]: d.boundary.id
        }
      }
    ]
  };
};

let buildUnnamedMagicMcpBoundaryFilter = (d: {
  boundary?: ConsumerCatalogBoundary | null;
  direction: ConsumerCatalogPageDirection;
  order: 'asc' | 'desc';
}) => {
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
};

let listProviderTemplateCatalogCandidates = async (d: {
  instance: Instance;
  search?: string;
  limit: number;
  direction: ConsumerCatalogPageDirection;
  order: 'asc' | 'desc';
  boundary?: ConsumerCatalogBoundary | null;
}) => {
  let queryOrder = d.direction == 'before' ? getReverseCatalogOrder(d.order) : d.order;
  let filters: Prisma.ProviderTemplateWhereInput[] = [];
  let searchFilter = buildNameDescriptionSearchFilter(d.search);
  let boundaryFilter = buildNamedCatalogBoundaryFilter({
    boundary: d.boundary,
    direction: d.direction,
    order: d.order
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
};

let listMagicMcpServerCatalogCandidates = async (d: {
  instance: Instance;
  search?: string;
  limit: number;
  direction: ConsumerCatalogPageDirection;
  order: 'asc' | 'desc';
  boundary?: ConsumerCatalogBoundary | null;
  nameMode: 'named' | 'unnamed';
}) => {
  let queryOrder = d.direction == 'before' ? getReverseCatalogOrder(d.order) : d.order;
  let filters: Prisma.MagicMcpServerWhereInput[] = [
    {
      NOT: {
        source: 'consumer_provider_template'
      }
    }
  ];
  let searchFilter = buildNameDescriptionSearchFilter(d.search);
  let boundaryFilter =
    d.nameMode == 'named'
      ? buildNamedCatalogBoundaryFilter({
          boundary: d.boundary,
          direction: d.direction,
          order: d.order
        })
      : buildUnnamedMagicMcpBoundaryFilter({
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
      name: d.nameMode == 'named' ? { not: null } : null,
      AND: filters
    },
    include: magicMcpCatalogInclude,
    orderBy: d.nameMode == 'named' ? [{ name: queryOrder }, { id: queryOrder }] : [{ id: queryOrder }],
    take: d.limit + 1
  });

  return {
    items: magicMcpServers.slice(0, d.limit),
    hasMore: magicMcpServers.length > d.limit
  };
};

let listConsumerCatalogPage = async (d: {
  instance: Instance;
  search?: string;
  accessTags?: AnyAccessTagSelector;
  includeCapabilities?: boolean;
  pagination: {
    limit: number;
    after?: string;
    before?: string;
    cursor?: string;
    order: 'asc' | 'desc';
  };
}) => {
  let direction: ConsumerCatalogPageDirection = d.pagination.before ? 'before' : 'after';
  let boundaryId = d.pagination.before ?? d.pagination.cursor ?? d.pagination.after;
  let boundary = boundaryId
    ? await getCatalogBoundary({
        instance: d.instance,
        catalogItemId: boundaryId
      })
    : null;

  let [providerTemplatePage, namedMagicMcpServerPage, unnamedMagicMcpServerPage] =
    await Promise.all([
      listProviderTemplateCatalogCandidates({
        instance: d.instance,
        search: d.search,
        limit: d.pagination.limit,
        direction,
        order: d.pagination.order,
        boundary
      }),
      listMagicMcpServerCatalogCandidates({
        instance: d.instance,
        search: d.search,
        limit: d.pagination.limit,
        direction,
        order: d.pagination.order,
        boundary,
        nameMode: 'named'
      }),
      listMagicMcpServerCatalogCandidates({
        instance: d.instance,
        search: d.search,
        limit: d.pagination.limit,
        direction,
        order: d.pagination.order,
        boundary,
        nameMode: 'unnamed'
      })
    ]);

  let [providerEntries, namedMagicMcpServerEntries, unnamedMagicMcpServerEntries] =
    await Promise.all([
      hydrateConsumerProviders({
        instance: d.instance,
        providerTemplates: providerTemplatePage.items,
        includeCapabilities: d.includeCapabilities,
        accessTags: d.accessTags
      }),
      hydratePreconfiguredMagicMcpServers({
        magicMcpServers: namedMagicMcpServerPage.items,
        accessTags: d.accessTags
      }),
      hydratePreconfiguredMagicMcpServers({
        magicMcpServers: unnamedMagicMcpServerPage.items,
        accessTags: d.accessTags
      })
    ]);

  let queryOrder = direction == 'before' ? getReverseCatalogOrder(d.pagination.order) : d.pagination.order;
  let entries = [
    ...providerEntries,
    ...namedMagicMcpServerEntries,
    ...unnamedMagicMcpServerEntries
  ].sort((left, right) => compareCatalogEntries(left, right, queryOrder));

  let hasMoreInQueryDirection =
    entries.length > d.pagination.limit ||
    providerTemplatePage.hasMore ||
    namedMagicMcpServerPage.hasMore ||
    unnamedMagicMcpServerPage.hasMore;

  let items = entries.slice(0, d.pagination.limit);
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
};

export let listConsumerCatalogEntries = async (d: {
  instance: Instance;
  search?: string;
  accessTags?: AnyAccessTagSelector;
  includeCapabilities?: boolean;
  pagination?: ConsumerCatalogListInput;
}) => {
  return await Paginator.create<ConsumerProviderCatalogEntry>(
    () => async input =>
      await listConsumerCatalogPage({
        instance: d.instance,
        search: d.search,
        accessTags: d.accessTags,
        includeCapabilities: d.includeCapabilities,
        pagination: input
      }),
    {
      defaultLimit: 50,
      defaultOrder: 'asc'
    }
  ).run(d.pagination ?? {});
};

export let listFeaturedConsumerCatalogEntries = async (d: {
  instance: Instance;
  accessTags?: AnyAccessTagSelector;
  limit?: number;
}) => {
  let list = await listConsumerCatalogEntries({
    instance: d.instance,
    accessTags: d.accessTags,
    pagination: {
      limit: d.limit ?? 6,
      order: 'asc'
    }
  });

  return list.items;
};

export let getConsumerProviderCatalogEntry = async (d: {
  instance: Instance;
  catalogItemId: string;
  accessTags?: AnyAccessTagSelector;
  includeCapabilities?: boolean;
}): Promise<ConsumerProviderCatalogEntry> => {
  let providerTemplate = await db.providerTemplate.findFirst({
    where: {
      instanceOid: d.instance.oid,
      id: d.catalogItemId,
      status: 'active'
    }
  });

  if (providerTemplate) {
    return (
      await hydrateConsumerProviders({
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
    await hydratePreconfiguredMagicMcpServers({
      magicMcpServers: [magicMcpServer],
      accessTags: d.accessTags
    })
  )[0];
};
