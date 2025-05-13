import { db } from '@metorial/db';
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
            ...opts
          })
      )
    );
  }
}

export let serverListingCollectionService = Service.create(
  'serverListingCollectionService',
  () => new ServerListingCollectionService()
).build();
