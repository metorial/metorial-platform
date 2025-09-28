import {
  db,
  ID,
  Instance,
  Organization,
  OrganizationActor,
  Server,
  ServerListing,
  withTransaction
} from '@metorial/db';
import { searchService } from '@metorial/module-search';
import { Paginator } from '@metorial/pagination';
import { Service } from '@metorial/service';
import { notFoundError, ServiceError } from '../../../../../packages/shared/error/src';
import { setCustomServerListingQueue } from '../queues/customListing';

let include = {
  categories: true,
  profile: true,
  server: {
    include: {
      importedServer: {
        omit: { readme: true },
        include: {
          vendor: true,
          repository: true
        }
      }
    }
  }
};

let getInclude = (instance: Instance | undefined) => ({
  ...include,
  server: {
    include: instance
      ? {
          ...include.server.include,
          instanceServers: {
            where: {
              instanceOid: instance.oid
            },
            include: {
              instance: true
            }
          }
        }
      : include.server.include
  }
});

class ServerListingService {
  async getServerListingById(d: { serverListingId: string; instance?: Instance }) {
    let serverListing = await db.serverListing.findFirst({
      where: {
        AND: [
          {
            OR: [
              { id: d.serverListingId },
              { slug: d.serverListingId },
              { server: { id: d.serverListingId } }
            ]
          },

          {
            OR: d.instance
              ? [{ ownerOrganizationOid: d.instance.organizationOid }, { isPublic: true }]
              : [{ isPublic: true }]
          }
          // d.instance
          //   ? {
          //       server: {
          //         OR: [
          //           { ownerOrganizationOid: d.instance.organizationOid },
          //           { ownerOrganizationOid: null, isPublic: true, status: 'active' }
          //         ]
          //       }
          //     }
          //   : { status: 'active' }
        ]
      },
      include: getInclude(d.instance)
    });
    if (!serverListing) {
      throw new ServiceError(notFoundError('server_listing', d.serverListingId));
    }

    return serverListing;
  }

  async updateServerListing(d: {
    serverListing: ServerListing;
    performedBy: OrganizationActor;
    input: {
      status?: 'active' | 'archived' | 'banned';
      name?: string;
      description?: string;
      slug?: string;
      readme?: string | null;
    };
  }) {
    let updates = {
      status: d.input.status ?? d.serverListing.status,
      name: d.input.name ?? d.serverListing.name,
      description: d.input.description ?? d.serverListing.description,
      slug: d.input.slug ?? d.serverListing.slug,
      readme: d.input.readme ?? d.serverListing.readme
    };

    return withTransaction(async db => {
      await db.serverListingUpdate.create({
        data: {
          id: await ID.generateId('serverListingUpdate'),
          serverListingOid: d.serverListing.oid,

          createdByOid: d.performedBy.oid,

          before: {
            status: d.serverListing.status,
            name: d.serverListing.name,
            description: d.serverListing.description,
            slug: d.serverListing.slug,
            readme: d.serverListing.readme
          },

          after: {
            status: updates.status,
            name: updates.name,
            description: updates.description,
            slug: updates.slug,
            readme: updates.readme
          }
        }
      });

      let serverListing = await db.serverListing.update({
        where: {
          id: d.serverListing.id
        },
        data: updates,
        include
      });

      return serverListing;
    });
  }

  async setServerListing(d: {
    server: Server;
    instance: Instance;
    organization: Organization;
  }) {
    await setCustomServerListingQueue.add({
      serverId: d.server.id,
      instanceId: d.instance.id,
      organizationId: d.organization.id
    });
  }

  async listServerListings(d: {
    search?: string;
    collectionIds?: string[];
    categoryIds?: string[];
    profileIds?: string[];
    providerIds?: string[];

    isPublic?: boolean;
    onlyFromOrganization?: boolean;

    instance?: Instance;

    orderByRank?: boolean;
  }) {
    let collections = d.collectionIds?.length
      ? await db.serverListingCollection.findMany({
          where: { OR: [{ id: { in: d.collectionIds } }, { slug: { in: d.collectionIds } }] }
        })
      : undefined;
    let categories = d.categoryIds?.length
      ? await db.serverListingCategory.findMany({
          where: { OR: [{ id: { in: d.categoryIds } }, { slug: { in: d.categoryIds } }] }
        })
      : undefined;
    let profiles = d.profileIds?.length
      ? await db.profile.findMany({
          where: { OR: [{ id: { in: d.profileIds } }, { slug: { in: d.profileIds } }] }
        })
      : undefined;
    let providers = d.providerIds?.length
      ? await db.serverVariantProvider.findMany({
          where: { OR: [{ id: { in: d.providerIds } }, { identifier: { in: d.providerIds } }] }
        })
      : undefined;

    d.search = d.search?.trim();
    if (!d.search?.length) d.search = undefined;

    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        let search = d.search
          ? await searchService.search<{ id: string }>({
              index: 'server_listing',
              query: d.search,
              options: {
                limit: opts.take * 2
              }
            })
          : undefined;

        return await db.serverListing.findMany({
          ...opts,

          orderBy: d.orderByRank ? { rank: 'desc' } : opts.orderBy,

          where: {
            status: 'active',

            AND: [
              {
                OR: [
                  { id: { in: search?.map(s => s.id) } },
                  { slug: { in: search?.map(s => s.id) } }
                ]
              },

              collections
                ? {
                    collections: {
                      some: { oid: { in: collections?.map(c => c.oid) } }
                    }
                  }
                : {},

              categories
                ? {
                    categories: {
                      some: { oid: { in: categories?.map(c => c.oid) } }
                    }
                  }
                : {},
              profiles
                ? {
                    profile: {
                      id: { in: profiles?.map(p => p.id) }
                    }
                  }
                : {},
              providers
                ? {
                    server: {
                      variants: {
                        some: {
                          providerOid: { in: providers?.map(p => p.oid) }
                        }
                      }
                    }
                  }
                : {},

              {
                OR: d.instance
                  ? [{ ownerOrganizationOid: d.instance.organizationOid }, { isPublic: true }]
                  : [{ isPublic: true }]
              },

              d.onlyFromOrganization
                ? { ownerOrganizationOid: d.instance?.organizationOid ?? -1 }
                : {},

              d.isPublic !== undefined ? { isPublic: d.isPublic } : {}

              // d.instance
              //   ? {
              //       server: {
              //         OR: [
              //           { ownerOrganizationOid: d.instance.organizationOid },
              //           { ownerOrganizationOid: null, isPublic: true, status: 'active' }
              //         ]
              //       }
              //     }
              //   : {}
            ]
          },
          include: getInclude(d.instance),
          omit: {
            readme: true
          }
        });
      })
    );
  }
}

export let serverListingService = Service.create(
  'serverListingService',
  () => new ServerListingService()
).build();
