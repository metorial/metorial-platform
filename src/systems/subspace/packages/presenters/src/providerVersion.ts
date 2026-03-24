import type { Provider, ProviderSpecification, ProviderVersion } from '@metorial-subspace/db';

export let providerVersionPresenter = (
  providerVersion: ProviderVersion & {
    provider: Provider;
    specification: Omit<ProviderSpecification, 'value'> | null;
  }
) => ({
  object: 'provider.version',

  id: providerVersion.id,

  tag: providerVersion.tag,
  identifier: providerVersion.identifier,

  providerId: providerVersion.provider.id,

  isCurrent: providerVersion.isCurrent,

  name: providerVersion.name,
  description: providerVersion.description,

  metadata: providerVersion.metadata,

  specificationId: providerVersion.specification?.id || null,

  createdAt: providerVersion.createdAt,
  updatedAt: providerVersion.updatedAt
});
