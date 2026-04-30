import { integrationInstanceProviderPresenter } from './integrationInstanceProvider';
import { integrationProviderSnapshotPresenter } from './integrationProvider';
import { providerPreviewPresenter } from './provider';

export let delegatedIntegrationInstanceProviderPresenter = (provider: any) => ({
  object: 'delegated.integration.instance.provider',

  id: provider.id,
  status: provider.status,

  name: provider.name,
  description: provider.description,
  metadata: provider.metadata,
  privateMetadata: provider.privateMetadata,

  delegatedIntegrationInstanceId: provider.delegatedIntegrationInstance.id,
  delegatedIntegrationInstanceSourceId: provider.delegatedIntegrationInstanceSource.id,
  integrationId: provider.integration.id,
  integrationInstanceId: provider.integrationInstance.id,
  integrationInstanceProviderId: provider.integrationInstanceProvider.id,
  integrationProviderId: provider.integrationProvider.id,

  toolFilter: provider.toolFilter,

  provider: providerPreviewPresenter(provider.integrationProvider.provider),

  integrationProvider: provider.integrationProvider.currentVersion
    ? integrationProviderSnapshotPresenter(
        provider.integrationProvider,
        provider.integrationProvider.currentVersion
      )
    : null,

  integrationInstanceProvider: integrationInstanceProviderPresenter(
    provider.integrationInstanceProvider
  ),

  createdAt: provider.createdAt,
  updatedAt: provider.updatedAt,
  archivedAt: provider.archivedAt
});
