import type {
  Provider,
  ProviderConfig,
  ProviderDeployment,
  ProviderDeploymentVersion,
  ProviderSpecification,
  ProviderVariant,
  ProviderVersion
} from '@metorial-subspace/db';
import { providerConfigPreviewPresenter } from './providerConfig';
import { providerVersionPresenter } from './providerVersion';

export let providerDeploymentPresenter = (
  providerDeployment: ProviderDeployment & {
    provider: Provider;
    providerVariant: ProviderVariant;
    defaultConfig: ProviderConfig | null;
    currentVersion:
      | (ProviderDeploymentVersion & {
          lockedVersion:
            | (ProviderVersion & { specification: ProviderSpecification | null })
            | null;
        })
      | null;
  }
) => ({
  object: 'provider.deployment',

  id: providerDeployment.id,

  isEphemeral: providerDeployment.isEphemeral,
  isDefault: providerDeployment.isDefault,

  name: providerDeployment.name,
  description: providerDeployment.description,
  metadata: providerDeployment.metadata,
  toolFilter: providerDeployment.toolFilter,

  providerId: providerDeployment.provider.id,

  lockedVersion: providerDeployment.currentVersion?.lockedVersion
    ? providerVersionPresenter({
        ...providerDeployment.currentVersion.lockedVersion,
        provider: providerDeployment.provider
      })
    : null,

  defaultConfig: providerDeployment.defaultConfig
    ? providerConfigPreviewPresenter({
        ...providerDeployment.defaultConfig,
        provider: providerDeployment.provider
      })
    : null,

  createdAt: providerDeployment.createdAt,
  updatedAt: providerDeployment.updatedAt
});

export let providerDeploymentPreviewPresenter = (
  providerDeployment: ProviderDeployment & {
    provider: Provider;
  }
) => ({
  object: 'provider.deployment#preview',

  id: providerDeployment.id,

  isEphemeral: providerDeployment.isEphemeral,
  isDefault: providerDeployment.isDefault,

  name: providerDeployment.name,
  description: providerDeployment.description,
  metadata: providerDeployment.metadata,
  toolFilter: (providerDeployment as any).toolFilter,

  providerId: providerDeployment.provider.id,

  createdAt: providerDeployment.createdAt,
  updatedAt: providerDeployment.updatedAt
});
