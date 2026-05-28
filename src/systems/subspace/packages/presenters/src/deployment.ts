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
    enclave?: { id: string } | null;
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

  status: providerDeployment.status,

  isEphemeral: providerDeployment.isEphemeral,
  isDefault: providerDeployment.isDefault,

  name: providerDeployment.name,
  description: providerDeployment.description,
  metadata: providerDeployment.metadata,
  privateMetadata: providerDeployment.privateMetadata,
  toolFilter: providerDeployment.toolFilter,

  providerId: providerDeployment.provider.id,
  enclaveId: providerDeployment.enclave?.id ?? null,

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
    enclave?: { id: string } | null;
  }
) => ({
  object: 'provider.deployment#preview',

  id: providerDeployment.id,

  isEphemeral: providerDeployment.isEphemeral,
  isDefault: providerDeployment.isDefault,

  name: providerDeployment.name,
  description: providerDeployment.description,
  metadata: providerDeployment.metadata,
  privateMetadata: providerDeployment.privateMetadata,
  toolFilter: (providerDeployment as any).toolFilter,

  providerId: providerDeployment.provider.id,
  enclaveId: providerDeployment.enclave?.id ?? null,

  createdAt: providerDeployment.createdAt,
  updatedAt: providerDeployment.updatedAt
});
