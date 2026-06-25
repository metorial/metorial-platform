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

class providerListingCollectionServiceImpl {
  async listProviderListingCollections(d: {
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
          await db.providerListingCollection.findMany({
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

  async getProviderListingCollectionById(d: {
    solution: Solution;
    tenant?: Tenant;
    environment?: Environment;
    providerListingCollectionId: string;
  }) {
    let providerListingCollection = await db.providerListingCollection.findFirst({
      where: {
        OR: [{ id: d.providerListingCollectionId }, { slug: d.providerListingCollectionId }]
      }
    });
    if (!providerListingCollection) {
      throw new ServiceError(
        notFoundError('provider.collection', d.providerListingCollectionId)
      );
    }

    return providerListingCollection;
  }

  async upsertProviderListingCollection(d: {
    input: { name: string; slug: string; description: string };
  }) {
    let inner = {
      name: d.input.name,
      slug: slugify(d.input.slug),
      description: d.input.description
    };

    return await db.providerListingCollection.upsert({
      where: { slug: inner.slug },
      create: {
        ...getId('providerCollection'),
        ...inner
      },
      update: {
        ...inner,
        description: d.input.description.trim() || undefined
      }
    });
  }
}

export let providerListingCollectionService = Service.create(
  'providerListingCollectionService',
  () => new providerListingCollectionServiceImpl()
).build();
