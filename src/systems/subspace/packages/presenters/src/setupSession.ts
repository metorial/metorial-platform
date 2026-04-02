import type {
  Identity,
  IdentityCredential,
  Provider,
  ProviderAuthConfig,
  ProviderAuthCredentials,
  ProviderAuthMethod,
  ProviderConfig,
  ProviderConfigVault,
  ProviderDeployment,
  ProviderSetupSession,
  ProviderSpecification
} from '@metorial-subspace/db';
import { providerAuthCredentialsPresenter } from './authCredentials';
import { providerDeploymentPreviewPresenter } from './deployment';
import { env } from './env';
import { providerAuthConfigPresenter } from './providerAuthConfig';
import { providerAuthMethodPresenter } from './providerAuthMethod';
import { providerConfigPresenter } from './providerConfig';

export let providerSetupSessionPresenter = (
  providerSetupSession: ProviderSetupSession & {
    identity: Identity | null;
    identityCredential: IdentityCredential | null;
    authConfig:
      | (ProviderAuthConfig & {
          deployment: ProviderDeployment | null;
          authCredentials: ProviderAuthCredentials | null;
          authMethod: ProviderAuthMethod & {
            specification: Omit<ProviderSpecification, 'value'>;
          };
        })
      | null;
    config:
      | (ProviderConfig & {
          deployment: ProviderDeployment | null;
          fromVault:
            | (ProviderConfigVault & {
                deployment: ProviderDeployment | null;
              })
            | null;
          specification: Omit<ProviderSpecification, 'value'>;
        })
      | null;
    deployment: ProviderDeployment | null;
    provider: Provider | null;
    authMethod:
      | (ProviderAuthMethod & { specification: Omit<ProviderSpecification, 'value'> })
      | null;
    authCredentials: ProviderAuthCredentials | null;
  }
) => {
  let status =
    providerSetupSession.status === 'pending' && providerSetupSession.expiresAt <= new Date()
      ? ('expired' as const)
      : providerSetupSession.status;

  return {
    object: 'provider.setup_session',

    id: providerSetupSession.id,
    type: providerSetupSession.type,

    status,

    url: `${env.service.PUBLIC_SERVICE_URL}/setup-session/${providerSetupSession.id}?client_secret=${providerSetupSession.clientSecret}`,

    name: providerSetupSession.name,
    description: providerSetupSession.description,
    metadata: providerSetupSession.metadata,

    providerId: providerSetupSession.provider?.id ?? null,
    identityId: providerSetupSession.identity?.id ?? null,
    identityCredentialId: providerSetupSession.identityCredential?.id ?? null,
    configuration: providerSetupSession.configuration ?? null,

    authMethod:
      providerSetupSession.provider && providerSetupSession.authMethod
        ? providerAuthMethodPresenter({
            ...providerSetupSession.authMethod,
            provider: providerSetupSession.provider
          })
        : null,

    deployment:
      providerSetupSession.deployment && providerSetupSession.provider
        ? providerDeploymentPreviewPresenter({
            ...providerSetupSession.deployment,
            provider: providerSetupSession.provider
          })
        : null,

    credentials:
      providerSetupSession.authCredentials && providerSetupSession.provider
        ? providerAuthCredentialsPresenter({
            ...providerSetupSession.authCredentials,
            provider: providerSetupSession.provider
          })
        : null,

    authConfig:
      providerSetupSession.authConfig && providerSetupSession.provider
        ? providerAuthConfigPresenter({
            ...providerSetupSession.authConfig,
            provider: providerSetupSession.provider
          })
        : null,

    config:
      providerSetupSession.config && providerSetupSession.provider
        ? providerConfigPresenter({
            ...providerSetupSession.config,
            provider: providerSetupSession.provider
          })
        : null,

    uiMode: providerSetupSession.uiMode,
    redirectUrl: providerSetupSession.redirectUrl,

    createdAt: providerSetupSession.createdAt,
    updatedAt: providerSetupSession.updatedAt,
    expiresAt: providerSetupSession.expiresAt
  };
};
