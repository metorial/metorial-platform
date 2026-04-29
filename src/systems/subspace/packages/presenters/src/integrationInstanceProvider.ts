import type {
  Integration,
  IntegrationInstance,
  IntegrationInstanceProvider,
  IntegrationInstanceProviderVersion,
  IntegrationProvider,
  IntegrationProviderVersion,
  Provider,
  ProviderAuthConfig,
  ProviderAuthCredentials,
  ProviderAuthMethod,
  ProviderConfig,
  ProviderDeployment,
  ProviderSpecification
} from '@metorial-subspace/db';
import { integrationProviderSnapshotPresenter } from './integrationProvider';
import { providerPreviewPresenter } from './provider';
import { providerAuthConfigPreviewPresenter } from './providerAuthConfig';
import { providerConfigPreviewPresenter } from './providerConfig';

export let integrationInstanceProviderVersionPresenter = (d: {
  provider: Provider;
  integrationProvider: IntegrationProvider & { provider: Provider };
  integrationInstanceProviderVersion: IntegrationInstanceProviderVersion & {
    integrationProviderVersion: IntegrationProviderVersion & {
      deployment: ProviderDeployment;
      authMethod:
        | (ProviderAuthMethod & { specification: Omit<ProviderSpecification, 'value'> })
        | null;
      authCredentials: ProviderAuthCredentials | null;
      config: ProviderConfig | null;
    };
    config: (ProviderConfig & { provider: Provider }) | null;
    authConfig: (ProviderAuthConfig & { provider: Provider }) | null;
  };
}) => ({
  status: d.integrationInstanceProviderVersion.status
});

export let integrationInstanceProviderPresenter = (
  integrationInstanceProvider: IntegrationInstanceProvider & {
    integration: Integration;
    integrationInstance: IntegrationInstance;
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
    };
    currentVersion:
      | (IntegrationInstanceProviderVersion & {
          integrationProviderVersion: IntegrationProviderVersion & {
            deployment: ProviderDeployment;
            authMethod:
              | (ProviderAuthMethod & { specification: Omit<ProviderSpecification, 'value'> })
              | null;
            authCredentials: ProviderAuthCredentials | null;
            config: ProviderConfig | null;
          };
          config: (ProviderConfig & { provider: Provider }) | null;
          authConfig: (ProviderAuthConfig & { provider: Provider }) | null;
        })
      | null;
  }
) => ({
  object: 'integration.instance.provider',

  id: integrationInstanceProvider.id,
  status: integrationInstanceProvider.status,

  name: integrationInstanceProvider.name,
  description: integrationInstanceProvider.description,
  metadata: integrationInstanceProvider.metadata,
  privateMetadata: integrationInstanceProvider.privateMetadata,

  integrationId: integrationInstanceProvider.integration.id,
  integrationInstanceId: integrationInstanceProvider.integrationInstance.id,
  integrationProviderId: integrationInstanceProvider.integrationProvider.id,

  toolFilter: integrationInstanceProvider.currentVersion!.toolFilter,

  provider: providerPreviewPresenter(integrationInstanceProvider.integrationProvider.provider),

  integrationProvider: integrationProviderSnapshotPresenter(
    integrationInstanceProvider.integrationProvider,
    integrationInstanceProvider.currentVersion!.integrationProviderVersion
  ),

  config:
    integrationInstanceProvider.currentVersion!.config ||
    integrationInstanceProvider.integrationProvider.currentVersion?.config
      ? providerConfigPreviewPresenter({
          ...(integrationInstanceProvider.currentVersion!.config ||
            integrationInstanceProvider.integrationProvider.currentVersion?.config)!,
          provider: integrationInstanceProvider.integrationProvider.provider
        })
      : undefined!,

  authConfig: integrationInstanceProvider.currentVersion!.authConfig
    ? providerAuthConfigPreviewPresenter(
        integrationInstanceProvider.currentVersion!.authConfig
      )
    : null,

  createdAt: integrationInstanceProvider.createdAt,
  updatedAt: integrationInstanceProvider.updatedAt,
  archivedAt: integrationInstanceProvider.archivedAt
});
