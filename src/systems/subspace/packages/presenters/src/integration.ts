import type {
  Integration,
  IntegrationProvider,
  IntegrationProviderVersion,
  IntegrationVersion,
  IntegrationVersionProvider,
  MagicMcpServerBacking,
  Provider,
  ProviderAuthCredentials,
  ProviderAuthMethod,
  ProviderConfig,
  ProviderDeployment,
  ProviderSpecification,
  ProviderTemplateBacking
} from '@metorial-subspace/db';
import { integrationProviderPresenter } from './integrationProvider';

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
    providerTemplateBacking: ProviderTemplateBacking | null;
    magicMcpServerBacking: MagicMcpServerBacking | null;
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

  providerTemplateBackingId: integration.providerTemplateBacking?.id ?? null,
  magicMcpServerBackingId: integration.magicMcpServerBacking?.id ?? null,

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

export let integrationPreviewPresenter = (integration: Integration) => ({
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

  createdAt: integration.createdAt,
  updatedAt: integration.updatedAt,
  archivedAt: integration.archivedAt
});
