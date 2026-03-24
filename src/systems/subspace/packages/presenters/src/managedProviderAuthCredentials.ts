import type {
  ManagedProviderAuthCredentials,
  Provider,
  ProviderAuthMethod,
  ProviderAuthCredentials
} from '@metorial-subspace/db';
import { providerAuthCredentialsPresenter } from './authCredentials';

export let managedProviderAuthCredentialsPresenter = (
  managedProviderAuthCredentials: ManagedProviderAuthCredentials & {
    providerAuthMethod: ProviderAuthMethod;
    providerAuthCredentials: ProviderAuthCredentials & {
      provider: Provider;
    };
  }
) => ({
  object: 'provider.auth_credentials.managed',

  id: managedProviderAuthCredentials.id,
  status: managedProviderAuthCredentials.status,

  providerAuthMethodId: managedProviderAuthCredentials.providerAuthMethod.id,
  providerAuthMethodName: managedProviderAuthCredentials.providerAuthMethod.name,
  oauthScopes: managedProviderAuthCredentials.oauthScopes,

  providerAuthCredentialsId: managedProviderAuthCredentials.providerAuthCredentials.id,
  authCredentials: providerAuthCredentialsPresenter(
    managedProviderAuthCredentials.providerAuthCredentials
  ),

  createdAt: managedProviderAuthCredentials.createdAt,
  updatedAt: managedProviderAuthCredentials.updatedAt
});
