import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  type Backend,
  getId,
  type Provider,
  type ProviderVariant,
  type Publisher,
  type ShuttleServer,
  type Slate,
  Solution,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import { getBackend } from '@metorial-subspace/provider';
import { ensureProviderType } from '@metorial-subspace/provider-utils';
import { createTag } from '../lib/createTag';
import { groupBy } from '../lib/groupBy';
import { listingCreatedQueue, listingUpdatedQueue } from '../queues/lifecycle/listing';
import { providerCreatedQueue, providerUpdatedQueue } from '../queues/lifecycle/provider';

class providerInternalServiceImpl {
  async enrichProviders<T extends Provider & { defaultVariant: ProviderVariant | null }>(d: {
    providers: T[];
  }) {
    let providersByBackend = groupBy(
      d.providers
        .filter(b => b.defaultVariant?.backendOid)
        .map(b => ({ ...b, backendOid: b.defaultVariant?.backendOid! })),
      'backendOid'
    );

    return (
      await Promise.all(
        providersByBackend.entries().map(async ([_, providers]) => {
          let anyProviderVariant = providers[0]?.defaultVariant;
          if (!anyProviderVariant) return [];

          let backend = await getBackend({ entity: anyProviderVariant });

          let enriched = await backend.enrichment.enrichProviderVariants({
            providerVariantIds: providers.map(p => p.defaultVariant!.id)
          });
          let enrichedMap = new Map<string, (typeof enriched.providers)[number]>(
            enriched.providers.map(p => [p.providerVariantId, p])
          );

          return providers.map(provider => {
            let enrichment = enrichedMap.get(provider.defaultVariant!.id);

            return {
              ...provider,
              ...(enrichment ?? {})
            };
          });
        })
      )
    ).flat();
  }

  async upsertProvider(d: {
    publisher: Publisher;

    owner: {
      tenant: Tenant;
      solution?: Solution | null;
    } | null;

    source:
      | {
          type: 'slates';
          slate: Slate;
          backend: Backend;
        }
      | {
          type: 'shuttle';
          shuttleServer: ShuttleServer;
          backend: Backend;
        }
      | {
          type: 'native';
          integrationIdentifier: string;
          backend: Backend;
        };

    info: {
      name: string;
      description?: string;
      slug: string;
      globalIdentifier: string | null;
      image?: PrismaJson.EntityImage | null;
      skills?: string[];
      readme?: string;
      categories?: string[];
    };

    type: {
      name: string;
      attributes: PrismaJson.ProviderTypeAttributes;
    };
  }) {
    return withTransaction(async db => {
      let identifier = `provider::${d.source.type}::`;

      if (d.source.type === 'slates') {
        identifier += `${d.source.slate.oid}`;
      } else if (d.source.type === 'shuttle') {
        identifier += `${d.source.shuttleServer.oid}`;
      } else if (d.source.type === 'native') {
        identifier += d.source.integrationIdentifier;
      } else {
        throw new Error('Unknown provider source type');
      }

      let providerEntryData = {
        identifier: `${identifier}::entry`,
        name: d.info.name,
        description: d.info.description,
        publisherOid: d.publisher.oid
      };
      let entry = await db.providerEntry.upsert({
        where: {
          identifier: providerEntryData.identifier
        },
        create: {
          ...getId('providerEntry'),
          ...providerEntryData
        },
        update: providerEntryData
      });

      let type = await ensureProviderType(d.type.name, d.type.attributes);

      let providerData = {
        identifier: `${identifier}::provider`,

        ...(d.owner
          ? {
              access: 'tenant' as const,
              ownerTenantOid: d.owner.tenant.oid,
              ownerSolutionOid: d.owner.solution?.oid
            }
          : {
              access: 'public' as const
            }),

        status: 'active' as const,

        name: d.info.name,
        description: d.info.description,

        entryOid: entry.oid,
        publisherOid: d.publisher.oid,
        typeOid: type.oid,

        globalIdentifier: d.info.globalIdentifier
      };
      let existingProvider = await db.provider.findFirst({
        where: {
          OR: [
            { identifier: providerData.identifier },
            providerData.globalIdentifier
              ? { globalIdentifier: providerData.globalIdentifier }
              : undefined!
          ].filter(Boolean)
        }
      });

      let newProviderId = getId('provider');
      let provider = existingProvider
        ? await db.provider.update({
            where: { oid: existingProvider.oid },
            data: providerData
          })
        : await db.provider.upsert({
            where: {
              identifier: providerData.identifier
            },
            create: {
              ...newProviderId,
              ...providerData,
              slug: d.info.slug,
              tag: await createTag()
            },
            update: providerData
          });

      let variantData = {
        identifier: `${identifier}::variant`,

        isDefault: true,

        name: d.info.name,
        description: d.info.description,

        backendOid: d.source.backend.oid,
        providerOid: provider.oid,
        publisherOid: d.publisher.oid,

        slateOid: d.source.type === 'slates' ? d.source.slate.oid : null,
        shuttleServerOid: d.source.type === 'shuttle' ? d.source.shuttleServer.oid : null
      };

      let existingVariant = await db.providerVariant.findFirst({
        where: { identifier: variantData.identifier }
      });

      let variant = existingVariant
        ? await db.providerVariant.update({
            where: { identifier: variantData.identifier },
            data: variantData
          })
        : await db.providerVariant.upsert({
            where: { identifier: variantData.identifier },
            create: {
              ...getId('providerVariant'),
              ...variantData,
              tag: await createTag()
            },
            update: variantData
          });

      await db.provider.updateMany({
        where: { oid: provider.oid },
        data: { defaultVariantOid: variant.oid }
      });

      let listing = await db.providerListing.findFirst({
        where: { providerOid: provider.oid }
      });

      let allData = {
        isPublic: provider.access === 'public',
        ownerTenantOid: provider.access === 'tenant' ? provider.ownerTenantOid : null,
        ownerSolutionOid: provider.access === 'tenant' ? provider.ownerSolutionOid : null,

        publisherOid: provider.publisherOid,
        providerOid: provider.oid
      };

      let newListingId = getId('providerListing');
      if (!listing?.isCustomized) {
        let inner = {
          ...allData,

          name: d.info.name,
          description: d.info.description,
          slug: d.info.slug,

          image: d.info.image ?? { type: 'default' as const },

          readme: d.info.readme,

          skills: d.info.skills || [],

          isCustomized: false,

          isMetorial: d.publisher.type === 'metorial',
          isVerified: d.publisher.type === 'metorial',
          isOfficial: false
        };

        listing = await db.providerListing.upsert({
          where: { providerOid: provider.oid },
          create: {
            ...newListingId,
            ...inner,
            status: 'active'
          },
          update: inner
        });
      } else {
        listing = await db.providerListing.update({
          where: { providerOid: provider.oid },
          data: allData
        });
      }

      if (d.info.categories) {
        let categories = await db.providerListingCategory.findMany({
          where: {
            slug: { in: d.info.categories }
          }
        });
        await db.providerListing.update({
          where: { id: listing.id },
          data: {
            categories: {
              set: categories.map(c => ({ oid: c.oid }))
            }
          }
        });
      }

      await addAfterTransactionHook(async () => {
        if (provider.id === newProviderId.id) {
          await providerCreatedQueue.add({ providerId: provider.id });
        } else {
          await providerUpdatedQueue.add({ providerId: provider.id });
        }
      });
      await addAfterTransactionHook(async () => {
        if (listing.id === newListingId.id) {
          await listingCreatedQueue.add({ providerListingId: listing.id });
        } else {
          await listingUpdatedQueue.add({ providerListingId: listing.id });
        }
      });

      return await db.provider.findFirstOrThrow({
        where: { oid: provider.oid },
        include: {
          defaultVariant: true
        }
      });
    });
  }

  async updateProvider(d: {
    provider: Provider;
    input: {
      name?: string;
      description?: string;
      readme?: string;
      slug?: string;
      image?: PrismaJson.EntityImage | null;
      skills?: string[];
      access?: 'public' | 'tenant';
    };
  }) {
    return withTransaction(async db => {
      let provider = await db.provider.update({
        where: { id: d.provider.id },
        data: {
          slug: d.input.slug,
          name: d.input.name?.trim() || undefined,
          description: d.input.description?.trim() || undefined,
          access: d.input.access
        }
      });

      let listing = await db.providerListing.update({
        where: { providerOid: provider.oid },
        data: {
          slug: provider.slug,
          name: provider.name,
          description: provider.description,
          readme: d.input.readme,
          skills: d.input.skills,
          image: d.input.image ?? undefined,
          isPublic: provider.access === 'public'
        }
      });

      await addAfterTransactionHook(() =>
        listingUpdatedQueue.add({ providerListingId: listing.id })
      );

      return provider;
    });
  }
}

export let providerInternalService = Service.create(
  'providerInternalService',
  () => new providerInternalServiceImpl()
).build();
