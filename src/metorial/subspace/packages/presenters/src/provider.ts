import type {
  Provider,
  ProviderEntry,
  ProviderListing,
  ProviderSpecification,
  ProviderType,
  ProviderVariant,
  ProviderVersion,
  Publisher,
  Tenant
} from '@metorial-subspace/db';
import { getImageUrl } from './brand';
import { providerEntryPresenter } from './providerEntry';
import { providerTypePresenter } from './providerType';
import { providerVariantPresenter } from './providerVariant';
import { providerVersionPresenter } from './providerVersion';
import { publisherPresenter } from './publisher';
import { tenantPresenter } from './tenant';

export let providerPresenter = async (
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
  },
  d: { tenant: Tenant | undefined }
) => {
  let type = await providerTypePresenter(provider.type, {
    tenant: d.tenant,
    provider
  });

  return {
    object: 'provider',

    id: provider.id,
    access: provider.access,
    status: provider.status,
    isDeprecated: provider.isDeprecated,

    ownerTenant: provider.ownerTenant ? tenantPresenter(provider.ownerTenant) : null,
    publisher: publisherPresenter(provider.publisher),
    entry: providerEntryPresenter(provider.entry),

    defaultVariant: provider.defaultVariant
      ? providerVariantPresenter({
          ...provider.defaultVariant,
          provider
        })
      : null,
    currentVersion: provider.defaultVariant?.currentVersion
      ? providerVersionPresenter({
          ...provider.defaultVariant.currentVersion,
          provider
        })
      : null,

    type,

    oauth:
      type.auth.status === 'enabled' && type.auth.oauth.status === 'enabled'
        ? {
            status: 'enabled',
            callbackUrl: type.auth.oauth.oauthCallbackUrl,

            autoRegistration:
              type.auth.oauth.oauthAutoRegistration?.status === 'supported'
                ? { status: 'supported' }
                : null
          }
        : null,

    identifier: provider.identifier,

    tag: provider.tag,

    name: provider.name,
    description: provider.description,
    slug: provider.prettySlug ?? provider.slug,
    globalIdentifier: provider.globalIdentifier,
    metadata: provider.metadata,

    createdAt: provider.createdAt,
    updatedAt: provider.updatedAt
  };
};

export let providerPreviewPresenter = (
  provider: Provider & { listing?: Pick<ProviderListing, 'id' | 'image'> | null }
) => ({
  object: 'provider',

  id: provider.id,
  access: provider.access,
  status: provider.status,
  isDeprecated: provider.isDeprecated,

  tag: provider.tag,

  name: provider.name,
  description: provider.description,
  slug: provider.prettySlug ?? provider.slug,
  metadata: provider.metadata,
  imageUrl: provider.listing
    ? getImageUrl({
        id: provider.listing.id,
        image: provider.listing.image
      })
    : null,

  createdAt: provider.createdAt,
  updatedAt: provider.updatedAt
});
