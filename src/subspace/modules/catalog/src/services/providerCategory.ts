import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { slugify } from '@lowerdeck/slugify';
import {
  db,
  type Environment,
  getId,
  type Solution,
  type Tenant
} from '@metorial-subspace/db';
import { resolveProviderListings, resolveProviders } from '@metorial-subspace/list-utils';

class providerListingCategoryServiceImpl {
  async listProviderListingCategories(d: {
    solution: Solution;
    tenant?: Tenant;
    environment?: Environment;

    ids?: string[];
    providerIds?: string[];
    providerListingIds?: string[];
  }) {
    let providers = await resolveProviders(d, d.providerIds);
    let providerListings = await resolveProviderListings(d, d.providerListingIds);

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.providerListingCategory.findMany({
            ...opts,
            where: {
              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,

                providers ? { listings: { some: { providerOid: providers.in } } } : undefined!,
                providerListings
                  ? { listings: { some: { oid: providerListings.in } } }
                  : undefined!
              ].filter(Boolean)
            }
          })
      )
    );
  }

  async getProviderListingCategoryById(d: {
    solution: Solution;
    tenant?: Tenant;
    environment?: Environment;
    providerListingCategoryId: string;
  }) {
    let providerListingCategory = await db.providerListingCategory.findFirst({
      where: {
        OR: [{ id: d.providerListingCategoryId }, { slug: d.providerListingCategoryId }]
      }
    });
    if (!providerListingCategory) {
      throw new ServiceError(notFoundError('provider.category', d.providerListingCategoryId));
    }

    return providerListingCategory;
  }

  async upsertProviderListingCategory(d: {
    input: { name: string; slug: string; description: string };
  }) {
    let inner = {
      name: d.input.name,
      slug: slugify(d.input.slug),
      description: d.input.description
    };

    return await db.providerListingCategory.upsert({
      where: { slug: inner.slug },
      create: {
        ...getId('providerCategory'),
        ...inner
      },
      update: inner
    });
  }
}

export let providerListingCategoryService = Service.create(
  'providerListingCategoryService',
  () => new providerListingCategoryServiceImpl()
).build();
