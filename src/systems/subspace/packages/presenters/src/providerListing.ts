import type {
  Provider,
  ProviderEntry,
  ProviderListing,
  ProviderListingCategory,
  ProviderListingCollection,
  ProviderListingGroup,
  ProviderSpecification,
  ProviderType,
  ProviderVariant,
  ProviderVersion,
  Publisher,
  Tenant
} from '@metorial-subspace/db';
import { providerPresenter } from './provider';
import { providerListingCategoryPresenter } from './providerListingCategory';
import { providerListingCollectionPresenter } from './providerListingCollection';
import { providerListingGroupPresenter } from './providerListingGroup';

export let providerListingPresenter = (
  providerListing: Omit<ProviderListing, 'readme'> & {
    provider: Provider & {
      entry: ProviderEntry;
      publisher: Publisher;
      ownerTenant: Tenant | null;

      defaultVariant:
        | (ProviderVariant & {
            provider: Provider;
            currentVersion:
              | (ProviderVersion & {
                  specification: Omit<ProviderSpecification, 'value'> | null;
                })
              | null;
          })
        | null;

      type: ProviderType;
    };

    categories?: ProviderListingCategory[];
    collections?: ProviderListingCollection[];
    groups?: ProviderListingGroup[];
  } & {
    readme?: string | null;
  },
  d: { tenant: Tenant | undefined }
) => ({
  object: 'provider.listing',

  id: providerListing.id,

  isPublic: providerListing.isPublic,
  isCustomized: providerListing.isCustomized,

  isMetorial: providerListing.isMetorial,
  isVerified: providerListing.isVerified,
  isOfficial: providerListing.isOfficial,

  name: providerListing.name,
  description: providerListing.description,
  slug: providerListing.slug,
  image: providerListing.image,

  readme: providerListing.readme ?? null,
  skills: providerListing.skills,

  rank: providerListing.rank,

  deploymentsCount: providerListing.deploymentsCount,
  providerSessionsCount: providerListing.providerSessionsCount,
  providerMessagesCount: providerListing.providerMessagesCount,

  provider: providerPresenter(providerListing.provider, d),

  categories: (providerListing.categories ?? []).map(category =>
    providerListingCategoryPresenter(category)
  ),
  collections: (providerListing.collections ?? []).map(category =>
    providerListingCollectionPresenter(category)
  ),
  groups: (providerListing.groups ?? []).map(category =>
    providerListingGroupPresenter(category)
  ),

  createdAt: providerListing.createdAt,
  updatedAt: providerListing.updatedAt
});
