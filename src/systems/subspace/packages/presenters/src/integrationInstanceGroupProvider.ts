import type {
  Integration,
  IntegrationInstance,
  IntegrationInstanceGroup,
  IntegrationInstanceGroupProvider,
  IntegrationInstanceGroupSource,
  IntegrationProvider,
  IntegrationProviderVersion,
  Provider,
  ProviderAuthCredentials,
  ProviderAuthMethod,
  ProviderConfig,
  ProviderDeployment,
  ProviderSpecification
} from '@metorial-subspace/db';
import { integrationInstanceProviderPresenter } from './integrationInstanceProvider';
import { integrationProviderSnapshotPresenter } from './integrationProvider';
import { providerPreviewPresenter } from './provider';

let presentToolFilter = (
  toolFilter: PrismaJson.ToolFilter | null,
  isOverrideToolFilter?: boolean
) => {
  if (!toolFilter) return toolFilter;

  return {
    ...toolFilter,
    ignoreParentFilters: isOverrideToolFilter || undefined
  };
};

export type PresentedIntegrationInstanceGroupProvider = IntegrationInstanceGroupProvider & {
  integrationInstanceGroup: IntegrationInstanceGroup;
  integrationInstanceGroupSource: IntegrationInstanceGroupSource & {
    integrationInstance: IntegrationInstance;
  };
  integration: Integration;
  integrationInstance: IntegrationInstance;
  integrationInstanceProvider: Parameters<typeof integrationInstanceProviderPresenter>[0];
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
};

export let integrationInstanceGroupProviderPresenter = (
  provider: PresentedIntegrationInstanceGroupProvider
) => ({
  object: 'integration.instance.group.provider',

  id: provider.id,
  status: provider.status,

  name: provider.name,
  description: provider.description,
  metadata: provider.metadata,
  privateMetadata: provider.privateMetadata,

  integrationInstanceGroupId: provider.integrationInstanceGroup.id,
  integrationInstanceGroupSourceId: provider.integrationInstanceGroupSource.id,
  integrationId: provider.integration.id,
  integrationInstanceId: provider.integrationInstance.id,
  integrationInstanceProviderId: provider.integrationInstanceProvider.id,
  integrationProviderId: provider.integrationProvider.id,

  toolFilter: presentToolFilter(provider.toolFilter, provider.isOverrideToolFilter),
  isOverrideToolFilter: provider.isOverrideToolFilter,

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
