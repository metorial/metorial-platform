import type {
  Provider,
  ProviderSpecification,
  ProviderVariant,
  ProviderVersion
} from '@metorial-subspace/db';
import { providerVersionPresenter } from './providerVersion';

export let providerVariantPresenter = (
  providerVariant: ProviderVariant & {
    provider: Provider;
    currentVersion:
      | (ProviderVersion & { specification: Omit<ProviderSpecification, 'value'> | null })
      | null;
  }
) => ({
  object: 'provider.variant',

  id: providerVariant.id,

  tag: providerVariant.tag,
  identifier: providerVariant.identifier,

  providerId: providerVariant.provider.id,

  isDefault: providerVariant.isDefault,

  name: providerVariant.name,
  description: providerVariant.description,

  metadata: providerVariant.metadata,

  currentVersion: providerVariant.currentVersion
    ? providerVersionPresenter({
        ...providerVariant.currentVersion,
        provider: providerVariant.provider
      })
    : null,

  createdAt: providerVariant.createdAt,
  updatedAt: providerVariant.updatedAt
});
