import type {
  Provider,
  ProviderConfig,
  ProviderConfigVault,
  ProviderDeployment,
  ProviderSpecification
} from '@metorial-subspace/db';
import { providerDeploymentPreviewPresenter } from './deployment';
import { providerConfigVaultPresenter } from './vault';

export let providerConfigPresenter = (
  providerConfig: ProviderConfig & {
    provider: Provider;
    deployment: ProviderDeployment | null;
    fromVault:
      | (ProviderConfigVault & {
          deployment: ProviderDeployment | null;
        })
      | null;
    specification: Omit<ProviderSpecification, 'value'>;
  }
) => ({
  object: 'provider.config',

  id: providerConfig.id,

  isEphemeral: providerConfig.isEphemeral,
  isDefault: providerConfig.isDefault,

  name: providerConfig.name,
  description: providerConfig.description,
  metadata: providerConfig.metadata,

  providerId: providerConfig.provider.id,
  specificationId: providerConfig.specification.id,

  deployment: providerConfig.deployment
    ? providerDeploymentPreviewPresenter({
        ...providerConfig.deployment,
        provider: providerConfig.provider
      })
    : null,

  fromVault: providerConfig.fromVault
    ? providerConfigVaultPresenter({
        ...providerConfig.fromVault,
        provider: providerConfig.provider
      })
    : null,

  createdAt: providerConfig.createdAt,
  updatedAt: providerConfig.updatedAt
});

export let providerConfigPreviewPresenter = (
  providerConfig: ProviderConfig & {
    provider: Provider;
  }
) => ({
  object: 'provider.config#preview',

  id: providerConfig.id,

  isEphemeral: providerConfig.isEphemeral,
  isDefault: providerConfig.isDefault,

  name: providerConfig.name,
  description: providerConfig.description,
  metadata: providerConfig.metadata,

  providerId: providerConfig.provider.id,

  createdAt: providerConfig.createdAt,
  updatedAt: providerConfig.updatedAt
});

export let providerConfigSchemaPresenter = (
  providerSpecification: ProviderSpecification & {
    provider: Provider;
  }
) => ({
  object: 'provider.capabilities.config.schema',

  configSchema: providerSpecification.value.specification.configJsonSchema,
  configVisibility: providerSpecification.value.specification.configVisibility,

  specificationId: providerSpecification.id,
  providerId: providerSpecification.provider.id,

  createdAt: providerSpecification.createdAt,
  updatedAt: providerSpecification.updatedAt
});
