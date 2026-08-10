import type {
  Integration,
  IntegrationProvider,
  IntegrationProviderVersion,
  Provider,
  ProviderAuthCredentials,
  ProviderAuthMethod,
  ProviderConfig,
  ProviderDeployment,
  ProviderSpecification
} from '@metorial-subspace/db';
import { providerAuthCredentialsPresenter } from './authCredentials';
import { providerDeploymentPreviewPresenter } from './deployment';
import { providerPreviewPresenter } from './provider';
import { providerAuthMethodPresenter } from './providerAuthMethod';
import { providerConfigPreviewPresenter } from './providerConfig';

let integrationProviderVersionPresenter = (d: {
  provider: Provider;
  integrationProviderVersion: IntegrationProviderVersion & {
    deployment: ProviderDeployment;
    authMethod:
      | (ProviderAuthMethod & { specification: Omit<ProviderSpecification, 'value'> })
      | null;
    authCredentials: ProviderAuthCredentials | null;
    config: ProviderConfig | null;
  };
}) => ({
  status: d.integrationProviderVersion.status,
  toolFilter: d.integrationProviderVersion.toolFilter,

  provider: providerPreviewPresenter(d.provider),

  deployment: providerDeploymentPreviewPresenter({
    ...d.integrationProviderVersion.deployment,
    provider: d.provider
  }),

  authMethod: d.integrationProviderVersion.authMethod
    ? providerAuthMethodPresenter({
        ...d.integrationProviderVersion.authMethod,
        provider: d.provider
      })
    : null,

  authCredentials: d.integrationProviderVersion.authCredentials
    ? providerAuthCredentialsPresenter({
        ...d.integrationProviderVersion.authCredentials,
        provider: d.provider
      })
    : null,

  config: d.integrationProviderVersion.config
    ? providerConfigPreviewPresenter({
        ...d.integrationProviderVersion.config,
        provider: d.provider
      })
    : null
});

export let integrationProviderSnapshotPresenter = (
  integrationProvider: IntegrationProvider & { provider: Provider },
  integrationProviderVersion: IntegrationProviderVersion & {
    deployment: ProviderDeployment;
    authMethod:
      | (ProviderAuthMethod & { specification: Omit<ProviderSpecification, 'value'> })
      | null;
    authCredentials: ProviderAuthCredentials | null;
    config: ProviderConfig | null;
  }
) => ({
  object: 'integration.provider#snapshot',

  id: integrationProvider.id,
  providerVersionId: integrationProviderVersion.id,
  index: integrationProviderVersion.index,

  name: integrationProvider.name,
  description: integrationProvider.description,
  metadata: integrationProvider.metadata,

  ...integrationProviderVersionPresenter({
    provider: integrationProvider.provider,
    integrationProviderVersion
  }),

  createdAt: integrationProviderVersion.createdAt,
  updatedAt: integrationProviderVersion.createdAt,
  archivedAt:
    integrationProvider.status === 'archived'
      ? new Date(
          Math.min(
            integrationProviderVersion.createdAt.getTime(),
            integrationProvider.archivedAt?.getTime() ?? Infinity
          )
        )
      : null
});

export let integrationProviderPresenter = (
  integrationProvider: IntegrationProvider & {
    integration: Integration;
    provider: Provider;
    currentVersion:
      | (IntegrationProviderVersion & {
          deployment: ProviderDeployment;
          authMethod:
            | (ProviderAuthMethod & { specification: Omit<ProviderSpecification, 'value'> })
            | null;
          authCredentials: ProviderAuthCredentials | null;
          config: ProviderConfig | null;
        })
      | null;
  }
) => ({
  object: 'integration.provider',

  id: integrationProvider.id,

  name: integrationProvider.name,
  description: integrationProvider.description,
  metadata: integrationProvider.metadata,

  integrationId: integrationProvider.integration.id,

  ...integrationProviderVersionPresenter({
    provider: integrationProvider.provider,
    integrationProviderVersion: integrationProvider.currentVersion!
  }),

  createdAt: integrationProvider.createdAt,
  updatedAt: integrationProvider.updatedAt,
  archivedAt: integrationProvider.archivedAt
});
