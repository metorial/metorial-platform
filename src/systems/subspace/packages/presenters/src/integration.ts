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
import { integrationProviderPresenter } from './integrationProvider';
import { integrationVersionPresenter } from './integrationVersion';

export let integrationPresenter = (
  integration: Integration & {
    currentVersion:
      | (IntegrationVersion & {
          providers: (IntegrationVersionProvider & {
            integrationProviderVersion: IntegrationProviderVersion & {
              deployment: ProviderDeployment;
              authMethod:
                | (ProviderAuthMethod & {
                    specification: Omit<ProviderSpecification, 'value'>;
                  })
                | null;
              authCredentials: ProviderAuthCredentials | null;
              config: ProviderConfig | null;
              integrationProvider: IntegrationProvider & {
                provider: Provider;
              };
            };
          })[];
        })
      | null;
    providers: (IntegrationProvider & {
      provider: Provider;
      currentVersion:
        | (IntegrationProviderVersion & {
            deployment: ProviderDeployment;
            authMethod:
              | (ProviderAuthMethod & {
                  specification: Omit<ProviderSpecification, 'value'>;
                })
              | null;
            authCredentials: ProviderAuthCredentials | null;
            config: ProviderConfig | null;
          })
        | null;
    })[];
  }
) => ({
  object: 'integration',

  id: integration.id,
  status: integration.status,

  slug: integration.slug,
  name: integration.name,
  description: integration.description,
  metadata: integration.metadata,
  privateMetadata: integration.privateMetadata,

  canAttachCustomToolFilters: integration.canAttachCustomToolFilters,
  canAttachCustomProviderConfig: integration.canAttachCustomProviderConfig,
  canOverrideToolFilters: integration.canOverrideToolFilters,

  providers: integration.providers.map(provider =>
    integrationProviderPresenter({
      ...provider,
      integration
    })
  ),

  createdAt: integration.createdAt,
  updatedAt: integration.updatedAt,
  archivedAt: integration.archivedAt
});
