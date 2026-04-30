import type {
  Identity,
  IdentityCredential,
  IdentityDelegationConfig,
  IntegrationInstance,
  IntegrationInstanceProvider,
  Provider,
  ProviderAuthConfig,
  ProviderConfig,
  ProviderDeployment
} from '@metorial-subspace/db';

export let identityCredentialPresenter = (
  credential: IdentityCredential & {
    identity: Identity;
    integrationInstance: IntegrationInstance | null;
    integrationInstanceProvider: IntegrationInstanceProvider | null;
    provider: Provider;
    deployment: ProviderDeployment | null;
    config: ProviderConfig | null;
    authConfig: ProviderAuthConfig | null;
    delegationConfig: IdentityDelegationConfig | null;
  }
) => ({
  object: 'identity.credential',

  id: credential.id,
  status: credential.status,

  identityId: credential.identity.id,
  privateMetadata: credential.privateMetadata,

  providerId: credential.provider.id,
  deploymentId: credential.deployment?.id ?? null,
  configId: credential.config?.id ?? null,
  authConfigId: credential.authConfig?.id ?? null,
  integrationInstanceId: credential.integrationInstance?.id ?? null,
  integrationInstanceProviderId: credential.integrationInstanceProvider?.id ?? null,

  delegationConfigId: credential.delegationConfig?.id ?? null,

  createdAt: credential.createdAt,
  updatedAt: credential.updatedAt,
  archivedAt: credential.archivedAt
});
