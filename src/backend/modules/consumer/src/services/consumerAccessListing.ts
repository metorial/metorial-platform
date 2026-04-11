import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  ConsumerAccessListing,
  ConsumerAccessTargetType,
  ConsumerSurface,
  db,
  MagicMcpServer,
  ProviderTemplate
} from '@metorial/db';

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

    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        return await db.consumerAccessListing.findMany({
          ...opts,
          where: {
            surfaceOid: d.consumerSurface.oid,
            consumerAccesses: {
              some: {}
            },
            AND: [
              d.types?.length
                ? {
                    OR: [
                      d.types.includes('provider_template')
                        ? { providerTemplateOid: { not: null } }
                        : undefined!,
                      d.types.includes('magic_mcp_server')
                        ? { magicMcpServerOid: { not: null } }
                        : undefined!
                    ].filter(Boolean)
                  }
                : undefined!,
              hasGroupFilter
                ? {
                    consumerSurfaceProviderGroups: {
                      some: {
                        consumerSurfaceProviderGroupOid: {
                          in: groups?.map(group => group.oid) ?? []
                        }
                      }
                    }
                  }
                : undefined!,
              hasProviderTemplateFilter
                ? {
                    providerTemplateOid: {
                      in:
                        providerTemplates?.map(providerTemplate => providerTemplate.oid) ?? []
                    }
                  }
                : undefined!,
              hasMagicMcpServerFilter
                ? {
                    magicMcpServerOid: {
                      in: magicMcpServers?.map(magicMcpServer => magicMcpServer.oid) ?? []
                    }
                  }
                : undefined!,
              search
                ? {
                    OR: [
                      { name: { contains: search, mode: 'insensitive' } },
                      { description: { contains: search, mode: 'insensitive' } },
                      { readme: { contains: search, mode: 'insensitive' } },
                      {
                        providerTemplate: {
                          name: { contains: search, mode: 'insensitive' }
                        }
                      },
                      {
                        magicMcpServer: {
                          name: { contains: search, mode: 'insensitive' }
                        }
                      }
                    ]
                  }
                : undefined!,
              {
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
              }
            ].filter(Boolean)
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
}

export let consumerAccessListingService = Service.create(
  'consumerAccessListingService',
  () => new ConsumerAccessListingServiceImpl()
).build();
