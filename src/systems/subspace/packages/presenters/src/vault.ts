import type { Provider, ProviderConfigVault, ProviderDeployment } from '@metorial-subspace/db';
import { providerDeploymentPreviewPresenter } from './deployment';

export let providerConfigVaultPresenter = (
  providerConfigVault: ProviderConfigVault & {
    provider: Provider;
    deployment: ProviderDeployment | null;
  }
) => ({
  object: 'provider.config_vault',

  id: providerConfigVault.id,

  name: providerConfigVault.name,
  description: providerConfigVault.description,
  metadata: providerConfigVault.metadata,

  providerId: providerConfigVault.provider.id,

  deploymentId: providerConfigVault.deployment
    ? providerDeploymentPreviewPresenter({
        ...providerConfigVault.deployment,
        provider: providerConfigVault.provider
      })
    : null,

  createdAt: providerConfigVault.createdAt,
  updatedAt: providerConfigVault.updatedAt
});
