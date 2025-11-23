import { db, Instance, ServerListing, ServerListingCollection } from '@metorial/db';
import { notFoundError, ServiceError } from '@metorial/error';
import { Paginator } from '@metorial/pagination';
import { Service } from '@metorial/service';

class ServerListingCollectionService {
  async getServerListingCollectionById(d: { serverListingCollectionId: string }) {
    let serverListingCollection = await db.serverListingCollection.findFirst({
      where: {
        OR: [{ id: d.serverListingCollectionId }, { slug: d.serverListingCollectionId }]
      }
    });
    if (!serverListingCollection) {
      throw new ServiceError(notFoundError('server_collection', d.serverListingCollectionId));
    }

    return serverListingCollection;
  }

  async listServerListingCollections(d: {}) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.serverListingCollection.findMany({
            ...opts,
            where: {
              isPublic: true
            }
          })
      )
    );
  }

  async canEditCollection(d: {
    serverListingCollection: ServerListingCollection;
    instance: Instance;
  }) {
    if (d.serverListingCollection.instanceOid) {
      return d.serverListingCollection.instanceOid === d.instance.oid;
    }

    return false;
  }

  async addServerToCollection(d: {
    serverListingCollection: ServerListingCollection;
    serverListing: ServerListing;
  }) {
    await db.serverListing.update({
      where: { id: d.serverListing.id },
      data: {
        collections: {
          connect: { id: d.serverListingCollection.id }
        }
      },
      include: {
        collections: true
      }
    });
  }

  async removeServerFromCollection(d: {
    serverListingCollection: ServerListingCollection;
    serverListing: ServerListing;
  }) {
    return db.serverListing.update({
      where: { id: d.serverListing.id },
      data: {
        collections: {
          disconnect: { id: d.serverListingCollection.id }
        }
      }
    });
  }
}

export let serverListingCollectionService = Service.create(
  'serverListingCollectionService',
  () => new ServerListingCollectionService()
).build();
