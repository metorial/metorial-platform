import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  ConsumerAccessListing,
  ConsumerAccessTargetType,
  ConsumerSurface,
  db,
  MagicMcpServer,
  Prisma,
  ProviderTemplate
} from '@metorial/db';
import { searchMagicMcpServerIds, searchProviderTemplateIds } from '@metorial/module-search';

let include = {
  providerTemplate: true,
  magicMcpServer: true,
  consumerSurfaceProviderGroups: {
    include: {
      consumerSurfaceProviderGroup: true
    }
  }
} as const;

export type ConsumerAccessListingWithRelations = ConsumerAccessListing & {
  providerTemplate: ProviderTemplate | null;
  magicMcpServer: MagicMcpServer | null;
  consumerSurfaceProviderGroups: {
    consumerSurfaceProviderGroup: {
      id: string;
      name: string;
      description: string | null;
      index: number;
    };
  }[];
};

type ConsumerAccessListingSearchMatches = {
  providerTemplateIds?: string[];
  magicMcpServerIds?: string[];
};

class ConsumerAccessListingServiceImpl {
  async list(d: {
    consumerSurface: ConsumerSurface;
    consumerSurfaceProviderGroupIds?: string[];
    providerTemplateIds?: string[];
    magicMcpServerIds?: string[];
    types?: ConsumerAccessTargetType[];
    search?: string;
  }) {
    let hasGroupFilter = !!d.consumerSurfaceProviderGroupIds?.length;
    let hasProviderTemplateFilter = !!d.providerTemplateIds?.length;
    let hasMagicMcpServerFilter = !!d.magicMcpServerIds?.length;

    let [groups, providerTemplates, magicMcpServers] = await Promise.all([
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

        if (search) {
          filters.push({
            OR: [
              {
                providerTemplate: {
                  id: { in: searchMatches.providerTemplateIds ?? [] }
                }
              },
              {
                magicMcpServer: {
                  id: { in: searchMatches.magicMcpServerIds ?? [] }
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
            }
          ]
        });

        return await db.consumerAccessListing.findMany({
          ...opts,
          where: {
            surfaceOid: d.consumerSurface.oid,
            consumerAccesses: { some: {} },
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
        consumerAccesses: {
          some: {}
        },
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
        ]
      },
      include
    });

    if (!listing) {
      throw new ServiceError(notFoundError('consumer.access_listing'));
    }

    return listing;
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
