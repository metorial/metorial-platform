import type {
  ManagedProviderAuthCredentials,
  Provider,
  ProviderAuthMethod,
  ProviderAuthMethodGlobal
} from '@metorial-subspace/db';

export let managedProviderAuthCredentialsPresenter = (
  managedProviderAuthCredentials: ManagedProviderAuthCredentials & {
    provider: Provider | null;
    providerAuthMethodGlobal:
      | (ProviderAuthMethodGlobal & {
          currentInstance: ProviderAuthMethod | null;
        })
      | null;
    initialProviderAuthMethod: ProviderAuthMethod & {
      provider: Provider;
    };
  }
) => {
  let provider =
    managedProviderAuthCredentials.provider ??
    managedProviderAuthCredentials.initialProviderAuthMethod.provider;
  let providerAuthMethod =
    managedProviderAuthCredentials.providerAuthMethodGlobal?.currentInstance ??
    managedProviderAuthCredentials.initialProviderAuthMethod;

  return {
    object: 'provider.auth_credentials.managed',

    id: managedProviderAuthCredentials.id,
    status: managedProviderAuthCredentials.status,

    providerId: provider.id,
    providerAuthMethodId: providerAuthMethod.id,
    providerAuthMethodName: providerAuthMethod.name,

    name: managedProviderAuthCredentials.name,
    description: managedProviderAuthCredentials.description,
    metadata: managedProviderAuthCredentials.metadata,
    oauthScopes: managedProviderAuthCredentials.oauthScopes,

    createdAt: managedProviderAuthCredentials.createdAt,
    updatedAt: managedProviderAuthCredentials.updatedAt
  };
};
