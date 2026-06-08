import type {
  Integration,
  IntegrationProvider,
  IntegrationProviderVersion,
  IntegrationVersion,
  IntegrationVersionProvider,
  Provider,
  ProviderAuthCredentials,
  ProviderAuthMethod,
  ProviderConfig,
  ProviderDeployment,
  ProviderSpecification
} from '@metorial-subspace/db';
import { integrationProviderSnapshotPresenter } from './integrationProvider';

export let integrationVersionPresenter = (
  integrationVersion: IntegrationVersion & {
    integration: Integration;
    providers: (IntegrationVersionProvider & {
      integrationProviderVersion: IntegrationProviderVersion & {
        deployment: ProviderDeployment;
        authMethod:
          | (ProviderAuthMethod & { specification: Omit<ProviderSpecification, 'value'> })
          | null;
        authCredentials: ProviderAuthCredentials | null;
        config: ProviderConfig | null;
        integrationProvider: IntegrationProvider & {
          provider: Provider;
        };
      };
    })[];
  }
) => ({
  object: 'integration.version',

  id: integrationVersion.id,
  index: integrationVersion.index,

  integrationId: integrationVersion.integration?.id,

  providers: integrationVersion.providers.map(versionProvider =>
    integrationProviderSnapshotPresenter(
      versionProvider.integrationProviderVersion.integrationProvider,
      versionProvider.integrationProviderVersion
    )
  ),

  createdAt: integrationVersion.createdAt
});
