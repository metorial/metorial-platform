import { db } from '@metorial/db';
import { notFoundError, ServiceError } from '@metorial/error';
import { Paginator } from '@metorial/pagination';
import { Service } from '@metorial/service';

class ServerListingCategoryService {
  async getServerListingCategoryById(d: { serverListingCategoryId: string }) {
    let serverListingCategory = await db.serverListingCategory.findFirst({
      where: {
        OR: [{ id: d.serverListingCategoryId }, { slug: d.serverListingCategoryId }]
      }
    });
    if (!serverListingCategory) {
      throw new ServiceError(notFoundError('server_category', d.serverListingCategoryId));
    }

    return serverListingCategory;
  }

  async listServerListingCategories(d: {}) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.serverListingCategory.findMany({
            ...opts
          })
      )
    );
  }
}

export let serverListingCategoryService = Service.create(
  'serverListingCategoryService',
  () => new ServerListingCategoryService()
).build();
