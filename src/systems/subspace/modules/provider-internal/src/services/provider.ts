import { generateCode } from '@lowerdeck/id';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  type Backend,
  db,
  type EntityImage,
  getId,
  Prisma,
  type Provider,
  type ProviderVariant,
  type Publisher,
  type ShuttleServer,
  type Slate,
  type Solution,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import { getBackend } from '@metorial-subspace/provider';
import {
  ensureProviderType,
  type ProviderVariantEnrichment
} from '@metorial-subspace/provider-utils';
import { createTag } from '../lib/createTag';
import { groupBy } from '../lib/groupBy';
import { listingCreatedQueue, listingUpdatedQueue } from '../queues/lifecycle/listing';
import { providerCreatedQueue, providerUpdatedQueue } from '../queues/lifecycle/provider';

class providerInternalServiceImpl {
  async enrichProviders<T extends Provider & { defaultVariant: ProviderVariant | null }>(d: {
    providers: T[];
  }): Promise<Array<T & Partial<ProviderVariantEnrichment>>> {
    let providersByBackend = groupBy(
      d.providers
        .filter(b => b.defaultVariant?.backendOid)
        .map(b => ({ ...b, backendOid: b.defaultVariant?.backendOid! })),
      'backendOid'
    );

    return (
      await Promise.all(
        Array.from(providersByBackend.entries()).map(async ([_, providers]) => {
          let anyProviderVariant = providers[0]?.defaultVariant;
          if (!anyProviderVariant) return [];

          let backend = await getBackend({ entity: anyProviderVariant });

          let enriched = await backend.enrichment.enrichProviderVariants({
            providerVariantIds: providers.map(p => p.defaultVariant!.id)
          });
          let enrichedMap = new Map<string, ProviderVariantEnrichment>(
            enriched.providers.map(p => [p.providerVariantId, p])
          );

          return providers.map((provider): T & Partial<ProviderVariantEnrichment> => {
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
      prettySlug?: string;
      aliases?: string[];
      globalIdentifier: string | null;
      image?: EntityImage | null;
      skills?: string[];
      readme?: string;
      docs?: PrismaJson.ProviderListingDocs | null;
      categories?: string[];
    };

    type: {
      name: string;
      attributes: PrismaJson.ProviderTypeAttributes;
    };
  }) {
    let prettySlug = d.info.prettySlug;
    let existingWithPrettySlug = prettySlug
      ? await db.providerListing.findFirst({
          where: {
            prettySlug,
            provider: {
              slug: { not: d.info.slug },
              globalIdentifier: d.info.globalIdentifier
                ? { not: d.info.globalIdentifier }
                : undefined
            }
          }
        })
      : null;
    if (existingWithPrettySlug) prettySlug = `${prettySlug}-${generateCode(5)}`;

    return withTransaction(
      async db => {
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
          slug: d.info.slug,
          prettySlug,

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

          name: provider.name,
          description: provider.description,

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
          isDeprecated: provider.isDeprecated,
          ownerTenantOid: provider.access === 'tenant' ? provider.ownerTenantOid : null,
          ownerSolutionOid: provider.access === 'tenant' ? provider.ownerSolutionOid : null,

          publisherOid: provider.publisherOid,
          providerOid: provider.oid,

          typeOid: provider.typeOid
        };

        let newListingId = getId('providerListing');
        if (!listing?.isCustomized) {
          let inner = {
            ...allData,

            name: provider.name,
            description: provider.description,
            slug: provider.slug,

            prettySlug: provider.prettySlug,
            aliases: [...new Set(d.info.aliases)],

            image: d.info.image ?? { type: 'default' as const },

            readme: d.info.readme,
            docs: d.info.docs ?? Prisma.DbNull,

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
      },
      {
        timeout: 20000,
        maxWait: 20000
      }
    );
  }

  async updateProvider(d: {
    provider: Provider;
    input: {
      name?: string;
      description?: string;
      readme?: string;
      slug?: string;
      aliases?: string[];
      image?: EntityImage | null;
      skills?: string[];
      access?: 'public' | 'tenant';
      status?: 'active' | 'archived' | 'deleted';
      isDeprecated?: boolean;
      isPublic?: boolean;
      isMetorial?: boolean;
      isVerified?: boolean;
      isOfficial?: boolean;
      rank?: number;
    };
  }) {
    return withTransaction(async db => {
      let provider = await db.provider.update({
        where: { id: d.provider.id },
        data: {
          slug: d.input.slug,
          name: d.input.name?.trim() || undefined,
          description: d.input.description?.trim() || undefined,
          access: d.input.access,
          status: d.input.status,
          isDeprecated: d.input.isDeprecated
        }
      });

      let existingListing = await db.providerListing.findFirstOrThrow({
        where: { providerOid: provider.oid }
      });
      let snapshotListing = (listing: typeof existingListing) => ({
        id: listing.id,
        status: listing.status,
        isDeprecated: listing.isDeprecated,
        isPublic: listing.isPublic,
        isCustomized: listing.isCustomized,
        isMetorial: listing.isMetorial,
        isVerified: listing.isVerified,
        isOfficial: listing.isOfficial,
        name: listing.name,
        slug: listing.slug,
        prettySlug: listing.prettySlug,
        aliases: listing.aliases,
        image: listing.image,
        description: listing.description,
        readme: listing.readme,
        rank: listing.rank,
        skills: listing.skills
      });

      let before = snapshotListing(existingListing);
      let listing = await db.providerListing.update({
        where: { providerOid: provider.oid },
        data: {
          slug: provider.slug,
          name: provider.name,
          description: provider.description,
          readme: d.input.readme,
          aliases: d.input.aliases,
          skills: d.input.skills,
          image: d.input.image ?? undefined,
          isPublic: d.input.isPublic ?? provider.access === 'public',
          isDeprecated: d.input.isDeprecated ?? provider.isDeprecated,
          isMetorial: d.input.isMetorial,
          isVerified: d.input.isVerified,
          isOfficial: d.input.isOfficial,
          rank: d.input.rank,
          isCustomized: true
        }
      });

      await db.providerListingUpdate.create({
        data: {
          ...getId('providerListingUpdate'),
          providerListingOid: listing.oid,
          before,
          after: snapshotListing(listing)
        }
      });

      await addAfterTransactionHook(() =>
        listingUpdatedQueue.add({ providerListingId: listing.id })
      );

      return provider;
    });
  }

  async deprecateProvider(d: { provider: Provider }) {
    return withTransaction(async db => {
      let provider = await db.provider.update({
        where: { id: d.provider.id },
        data: { isDeprecated: true }
      });

      let listing = await db.providerListing.findFirst({
        where: { providerOid: provider.oid }
      });

      if (listing) {
        listing = await db.providerListing.update({
          where: { providerOid: provider.oid },
          data: { isDeprecated: true }
        });
      }

      await addAfterTransactionHook(async () => {
        await providerUpdatedQueue.add({ providerId: provider.id });

        if (listing) {
          await listingUpdatedQueue.add({ providerListingId: listing.id });
        }
      });

      return provider;
    });
  }
}

export let providerInternalService = Service.create(
  'providerInternalService',
  () => new providerInternalServiceImpl()
).build();
