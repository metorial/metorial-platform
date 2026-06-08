import type {
  Integration,
  IntegrationInstance,
  IntegrationInstanceProvider,
  IntegrationInstanceProviderVersion,
  IntegrationProvider,
  IntegrationProviderVersion,
  MagicMcpServerBacking,
  MagicMcpServerProvider,
  Provider,
  ProviderAuthConfig,
  ProviderAuthCredentials,
  ProviderAuthMethod,
  ProviderConfig,
  ProviderDeployment,
  ProviderSpecification,
  ProviderTemplateBacking
} from '@metorial-subspace/db';
import { providerAuthCredentialsPresenter } from './authCredentials';
import { providerDeploymentPreviewPresenter } from './deployment';
import { integrationInstanceProviderPresenter } from './integrationInstanceProvider';
import { integrationProviderSnapshotPresenter } from './integrationProvider';
import { providerPreviewPresenter } from './provider';
import { providerAuthConfigPreviewPresenter } from './providerAuthConfig';
import { providerAuthMethodPresenter } from './providerAuthMethod';
import { providerConfigPreviewPresenter } from './providerConfig';

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

export let magicMcpServerProviderPresenter = (
  row: MagicMcpServerProvider & {
    magicMcpServerBacking: MagicMcpServerBacking & {
      providerTemplateBacking:
        | (ProviderTemplateBacking & {
            integration: Integration;
          })
        | null;
      ownerIntegration: Integration | null;
      integration: Integration | null;
      integrationInstance: IntegrationInstance;
    };
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
    integrationInstanceProvider:
      | (IntegrationInstanceProvider & {
          integration: Integration;
          integrationInstance: IntegrationInstance;
          integrationProvider: IntegrationProvider & {
            integration: Integration;
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
          };
          currentVersion:
            | (IntegrationInstanceProviderVersion & {
                integrationProviderVersion: IntegrationProviderVersion & {
                  deployment: ProviderDeployment;
                  authMethod:
                    | (ProviderAuthMethod & {
                        specification: Omit<ProviderSpecification, 'value'>;
                      })
                    | null;
                  authCredentials: ProviderAuthCredentials | null;
                  config: ProviderConfig | null;
                };
                config: (ProviderConfig & { provider: Provider }) | null;
                authConfig: (ProviderAuthConfig & { provider: Provider }) | null;
              })
            | null;
        })
      | null;
  }
) => ({
  object: 'magic_mcp.server_provider',
  id: row.id,
  status: row.status,
  ownerType: row.magicMcpServerBacking.ownerType,
  magicMcpServerId: row.magicMcpServerBacking.id,
  integrationId: row.integrationProvider.integration.id,
  integrationInstanceId: row.magicMcpServerBacking.integrationInstance.id,
  integrationProviderId: row.integrationProvider.id,
  integrationInstanceProviderId: row.integrationInstanceProvider?.id ?? null,
  name: row.integrationInstanceProvider?.name ?? row.integrationProvider.name,
  description:
    row.integrationInstanceProvider?.description ?? row.integrationProvider.description,
  metadata: row.integrationInstanceProvider?.metadata ?? row.integrationProvider.metadata,
  toolFilter: presentToolFilter(
    row.integrationInstanceProvider?.currentVersion?.toolFilter ??
      row.integrationProvider.currentVersion?.toolFilter ??
      null,
    row.integrationInstanceProvider?.currentVersion?.isOverrideToolFilter
  ),
  isOverrideToolFilter:
    row.integrationInstanceProvider?.currentVersion?.isOverrideToolFilter ?? false,
  provider: providerPreviewPresenter(row.integrationProvider.provider),
  deployment:
    (row.integrationInstanceProvider?.currentVersion?.integrationProviderVersion.deployment ??
    row.integrationProvider.currentVersion?.deployment)
      ? providerDeploymentPreviewPresenter({
          ...(row.integrationInstanceProvider?.currentVersion?.integrationProviderVersion
            .deployment ?? row.integrationProvider.currentVersion?.deployment)!,
          provider: row.integrationProvider.provider
        })
      : null,
  authMethod:
    (row.integrationInstanceProvider?.currentVersion?.integrationProviderVersion.authMethod ??
    row.integrationProvider.currentVersion?.authMethod)
      ? providerAuthMethodPresenter({
          ...(row.integrationInstanceProvider?.currentVersion?.integrationProviderVersion
            .authMethod ?? row.integrationProvider.currentVersion?.authMethod)!,
          provider: row.integrationProvider.provider
        })
      : null,
  authCredentials:
    (row.integrationInstanceProvider?.currentVersion?.integrationProviderVersion
      .authCredentials ?? row.integrationProvider.currentVersion?.authCredentials)
      ? providerAuthCredentialsPresenter({
          ...(row.integrationInstanceProvider?.currentVersion?.integrationProviderVersion
            .authCredentials ?? row.integrationProvider.currentVersion?.authCredentials)!,
          provider: row.integrationProvider.provider
        })
      : null,
  config:
    (row.integrationInstanceProvider?.currentVersion?.config ??
    row.integrationProvider.currentVersion?.config)
      ? providerConfigPreviewPresenter({
          ...(row.integrationInstanceProvider?.currentVersion?.config ??
            row.integrationProvider.currentVersion?.config)!,
          provider: row.integrationProvider.provider
        })
      : null,
  authConfig: row.integrationInstanceProvider?.currentVersion?.authConfig
    ? providerAuthConfigPreviewPresenter(
        row.integrationInstanceProvider.currentVersion.authConfig
      )
    : null,
  integrationProvider: integrationProviderSnapshotPresenter(
    row.integrationProvider,
    row.integrationProvider.currentVersion!
  ),
  integrationInstanceProvider: row.integrationInstanceProvider
    ? integrationInstanceProviderPresenter(row.integrationInstanceProvider)
    : null,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  archivedAt: row.archivedAt
});
