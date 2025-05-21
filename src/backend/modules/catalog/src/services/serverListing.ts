import { db, Instance, ServerListing } from '@metorial/db';
import { searchService } from '@metorial/module-search';
import { Paginator } from '@metorial/pagination';
import { Service } from '@metorial/service';
import { notFoundError, ServiceError } from '../../../../../packages/shared/error/src';

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

class ServerListingService {
  async getServerListingById(d: { serverListingId: string }) {
    let serverListing = await db.serverListing.findFirst({
      where: {
        OR: [
          { id: d.serverListingId },
          { slug: d.serverListingId },
          { server: { id: d.serverListingId } }
        ]
      },
      include
    });
    if (!serverListing) {
      throw new ServiceError(notFoundError('server_listing', d.serverListingId));
    }

    return serverListing;
  }

  async ADMIN_updateServerListing(d: {
    serverListing: ServerListing;
    input: {
      status?: 'active' | 'archived' | 'banned';
      name?: string;
      description?: string;
      slug?: string;
    };
  }) {
    let serverListing = await db.serverListing.update({
      where: {
        id: d.serverListing.id
      },
      data: {
        status: d.input.status,
        name: d.input.name,
        description: d.input.description,
        slug: d.input.slug
      },
      include
    });

    return serverListing;
  }

  async listServerListings(d: {
    search?: string;
    collectionIds?: string[];
    categoryIds?: string[];
    profileIds?: string[];
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

    d.search = d.search?.trim();
    if (!d.search?.length) d.search = undefined;

    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        let search = d.search
          ? await searchService.search<{ id: string }>({
              index: 'server_listing',
              query: d.search,
              options: {
                limit: opts.take
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

              d.instance
                ? {
                    server: {
                      instanceServers: {
                        some: {
                          instanceOid: d.instance.oid
                        }
                      }
                    }
                  }
                : {}
            ]
          },
          include: {
            ...include,
            server: {
              include: d.instance
                ? {
                    ...include.server.include,
                    instanceServers: {
                      where: {
                        instanceOid: d.instance.oid
                      },
                      include: {
                        instance: true
                      }
                    }
                  }
                : include.server.include
            }
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
