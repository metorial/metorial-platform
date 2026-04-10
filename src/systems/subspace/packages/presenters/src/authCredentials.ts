import type { Provider, ProviderAuthCredentials } from '@metorial-subspace/db';

export let providerAuthCredentialsPresenter = (
  providerAuthCredentials: ProviderAuthCredentials & {
    provider: Provider;
  }
) => ({
  object: 'provider.auth_credentials',

  id: providerAuthCredentials.id,
  type: providerAuthCredentials.type,
  status: providerAuthCredentials.status,

  isEphemeral: providerAuthCredentials.isEphemeral,
  isDefault: providerAuthCredentials.isDefault,
  origin: providerAuthCredentials.origin,
  isManaged: providerAuthCredentials.origin !== 'tenant_created',

  providerId: providerAuthCredentials.provider.id,

  name: providerAuthCredentials.name,
  description: providerAuthCredentials.description,
  metadata: providerAuthCredentials.metadata,
  privateMetadata: providerAuthCredentials.privateMetadata,

  createdAt: providerAuthCredentials.createdAt,
  updatedAt: providerAuthCredentials.updatedAt
});
