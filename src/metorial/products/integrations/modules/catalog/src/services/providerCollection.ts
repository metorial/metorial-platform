import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { slugify } from '@lowerdeck/slugify';
import { db, type Environment, getId, type Tenant } from '@metorial-subspace/db';
import { resolveProviderListings, resolveProviders } from '@metorial-subspace/list-utils';
import {
  getMetorialSolution,
  type MetorialFacing,
  resolveMetorialFacing
} from '@metorial-subspace/module-tenant';

type ListProviderListingCollectionsParams = {
  ids?: string[];
  providerIds?: string[];
  providerListingIds?: string[];
};

type GetProviderListingCollectionByIdParams = {
  providerListingCollectionId: string;
};

class providerListingCollectionServiceImpl {
  async listProviderListingCollections(
    d: MetorialFacing<ListProviderListingCollectionsParams>
  ) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.listProviderListingCollectionsInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async listProviderListingCollectionsInternal(
    d: {
      tenant?: Tenant;
      environment?: Environment;
    } & ListProviderListingCollectionsParams
  ) {
    let solution = await getMetorialSolution();

    let providers = await resolveProviders({ ...d, solution }, d.providerIds);
    let providerListings = await resolveProviderListings({ ...d, solution }, d.providerListingIds);

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

  async getProviderListingCollectionById(
    d: MetorialFacing<GetProviderListingCollectionByIdParams>
  ) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getProviderListingCollectionByIdInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getProviderListingCollectionByIdInternal(
    d: {
      tenant?: Tenant;
      environment?: Environment;
    } & GetProviderListingCollectionByIdParams
  ) {
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
