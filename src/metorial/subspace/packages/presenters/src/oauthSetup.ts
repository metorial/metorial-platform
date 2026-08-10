import type {
  Provider,
  ProviderAuthConfig,
  ProviderAuthCredentials,
  ProviderAuthMethod,
  ProviderDeployment,
  ProviderOAuthSetup,
  ProviderSpecification
} from '@metorial-subspace/db';
import { providerAuthConfigPresenter } from './providerAuthConfig';
import { providerAuthCredentialsPresenter } from './authCredentials';
import { providerDeploymentPreviewPresenter } from './deployment';
import { env } from './env';
import { providerAuthMethodPresenter } from './providerAuthMethod';

export let providerOAuthSetupPresenter = (
  providerOAuthSetup: ProviderOAuthSetup & {
    provider: Provider;
    deployment: ProviderDeployment | null;
    authCredentials: ProviderAuthCredentials | null;
    authMethod: ProviderAuthMethod & { specification: ProviderSpecification };
    authConfig: (ProviderAuthConfig & { deployment: ProviderDeployment | null }) | null;
  }
) => {
  let status =
    (providerOAuthSetup.status === 'opened' || providerOAuthSetup.status === 'unused') &&
    providerOAuthSetup.expiresAt <= new Date()
      ? ('expired' as const)
      : providerOAuthSetup.status;

  return {
    object: 'provider.oauth_setup',

    id: providerOAuthSetup.id,
    status,

    isEphemeral: providerOAuthSetup.isEphemeral,

    providerId: providerOAuthSetup.provider.id,

    name: providerOAuthSetup.name,
    description: providerOAuthSetup.description,
    metadata: providerOAuthSetup.metadata,

    redirectUrl: providerOAuthSetup.redirectUrl,

    url:
      status !== 'expired' && status !== 'completed'
        ? `${env.service.PUBLIC_SERVICE_URL}/oauth-setup/${providerOAuthSetup.id}?client_secret=${providerOAuthSetup.clientSecret}`
        : null,

    authConfig: providerOAuthSetup.authConfig
      ? providerAuthConfigPresenter({
          ...providerOAuthSetup.authConfig,
          provider: providerOAuthSetup.provider,
          authCredentials: providerOAuthSetup.authCredentials,
          authMethod: providerOAuthSetup.authMethod
        })
      : null,

    credentials: providerOAuthSetup.authCredentials
      ? providerAuthCredentialsPresenter({
          ...providerOAuthSetup.authCredentials,
          provider: providerOAuthSetup.provider
        })
      : null,

    authMethod: providerAuthMethodPresenter({
      ...providerOAuthSetup.authMethod,
      provider: providerOAuthSetup.provider
    }),

    deployment: providerOAuthSetup.deployment
      ? providerDeploymentPreviewPresenter({
          ...providerOAuthSetup.deployment,
          provider: providerOAuthSetup.provider
        })
      : null,

    createdAt: providerOAuthSetup.createdAt,
    updatedAt: providerOAuthSetup.updatedAt,
    expiresAt: providerOAuthSetup.expiresAt
  };
};
