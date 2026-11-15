import type {
  Provider,
  ProviderAuthConfig,
  ProviderAuthCredentials,
  ProviderAuthMethod,
  ProviderDeployment,
  ProviderOAuthSetup,
  ProviderSpecification
} from '@metorial-subspace/db';
import { env } from '../../env';
import {
  setupSessionAuthConfigPresenter,
  setupSessionAuthCredentialsPresenter,
  setupSessionAuthMethodPresenter,
  setupSessionDeploymentPreviewPresenter
} from './setupSession';

export let setupSessionOAuthSetupPresenter = (
  providerOAuthSetup: ProviderOAuthSetup & {
    provider: Provider;
    deployment: ProviderDeployment | null;
    authCredentials: ProviderAuthCredentials | null;
    authMethod: ProviderAuthMethod & {
      specification: Omit<ProviderSpecification, 'value'>;
    };
    authConfig:
      | (ProviderAuthConfig & {
          deployment: ProviderDeployment | null;
        })
      | null;
  },
  opts: { isAdminSetup: boolean }
) => {
  let status =
    (providerOAuthSetup.status === 'opened' || providerOAuthSetup.status === 'unused') &&
    providerOAuthSetup.expiresAt <= new Date()
      ? ('expired' as const)
      : providerOAuthSetup.status;

  let isUsable =
    status !== 'expired' &&
    status !== 'completed' &&
    !(opts.isAdminSetup && status === 'failed');

  return {
    object: 'provider.oauth_setup',

    id: providerOAuthSetup.id,
    status,

    isEphemeral: providerOAuthSetup.isEphemeral,

    providerId: providerOAuthSetup.provider.id,

    name: providerOAuthSetup.name,
    description: providerOAuthSetup.description,
    metadata: providerOAuthSetup.metadata,
    toolFilter: providerOAuthSetup.toolFilter,

    redirectUrl: providerOAuthSetup.redirectUrl,
    errorCode: providerOAuthSetup.errorCode,
    errorMessage: providerOAuthSetup.errorMessage,
    adminInstructions: providerOAuthSetup.adminInstructions,

    url: isUsable
      ? `${env.service.INTEGRATIONS_API_URL}/oauth-setup/${providerOAuthSetup.id}?client_secret=${providerOAuthSetup.clientSecret}`
      : null,

    authConfig: providerOAuthSetup.authConfig
      ? setupSessionAuthConfigPresenter({
          ...providerOAuthSetup.authConfig,
          provider: providerOAuthSetup.provider,
          authCredentials: providerOAuthSetup.authCredentials,
          authMethod: providerOAuthSetup.authMethod
        })
      : null,

    credentials: providerOAuthSetup.authCredentials
      ? setupSessionAuthCredentialsPresenter({
          ...providerOAuthSetup.authCredentials,
          provider: providerOAuthSetup.provider
        })
      : null,

    authMethod: setupSessionAuthMethodPresenter({
      ...providerOAuthSetup.authMethod,
      provider: providerOAuthSetup.provider
    }),

    deployment: providerOAuthSetup.deployment
      ? setupSessionDeploymentPreviewPresenter({
          ...providerOAuthSetup.deployment,
          provider: providerOAuthSetup.provider
        })
      : null,

    createdAt: providerOAuthSetup.createdAt,
    updatedAt: providerOAuthSetup.updatedAt,
    expiresAt: providerOAuthSetup.expiresAt
  };
};
