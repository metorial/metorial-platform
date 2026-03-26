import type {
  Identity,
  IdentityCredential,
  IdentityDelegationConfig,
  Provider,
  ProviderAuthConfig,
  ProviderConfig,
  ProviderDeployment
} from '@metorial-subspace/db';

export let identityCredentialPresenter = (
  credential: IdentityCredential & {
    identity: Identity;
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

  providerId: credential.provider.id,
  deploymentId: credential.deployment?.id ?? null,
  configId: credential.config?.id ?? null,
  authConfigId: credential.authConfig?.id ?? null,

  delegationConfigId: credential.delegationConfig?.id ?? null,

  createdAt: credential.createdAt,
  updatedAt: credential.updatedAt,
  archivedAt: credential.archivedAt
});
