import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { magicMcpServerProviderType } from '../../types';
import { toolFilterPresenter } from '../_lib/toolFilter';
import { v1ProviderAuthCredentialsPresenter } from './authCredentials';
import { v1ProviderAuthConfigPreviewPresenter } from './authConfigPreview';
import { v1ProviderConfigPreviewPresenter } from './configPreview';
import { v1IntegrationProviderSnapshot } from './integrationProvider';
import { v1ProviderAuthMethodPresenter } from './authMethod';
import { v1ProviderDeploymentPreviewPresenter } from './deploymentPreview';
import { v1ProviderPreview } from './providerPreview';

let presentToolFilter = (toolFilter: PrismaJson.ToolFilter | null | undefined) =>
  toolFilter ? toolFilterPresenter(toolFilter as any) : null;

export let v1MagicMcpServerProviderPresenter = Presenter.create(magicMcpServerProviderType)
  .presenter(async ({ magicMcpServer, integrationInstanceProvider }, opts) => {
    let integrationProvider = await v1IntegrationProviderSnapshot(
      integrationInstanceProvider.integrationProvider,
      opts
    );
    let config = integrationInstanceProvider.config
      ? await v1ProviderConfigPreviewPresenter
          .present({ config: integrationInstanceProvider.config }, opts)
          .run()
      : integrationProvider.config;

    return {
      object: 'magic_mcp.server.provider' as const,
      id: integrationInstanceProvider.id,
      status: integrationInstanceProvider.status,
      magic_mcp_server_id: magicMcpServer.id,
      integration_id: integrationInstanceProvider.integrationId,
      integration_instance_id: integrationInstanceProvider.integrationInstanceId,
      integration_provider_id: integrationInstanceProvider.integrationProvider.id,
      name: integrationInstanceProvider.name,
      description: integrationInstanceProvider.description,
      metadata: integrationInstanceProvider.metadata,
      tool_filter: presentToolFilter(integrationInstanceProvider.toolFilter),
      is_override_tool_filter: integrationInstanceProvider.isOverrideToolFilter,
      provider: v1ProviderPreview(integrationInstanceProvider.provider),
      deployment: integrationProvider.deployment,
      auth_method: integrationProvider.auth_method,
      auth_credentials: integrationProvider.auth_credentials,
      config,
      auth_config: integrationInstanceProvider.authConfig
        ? await v1ProviderAuthConfigPreviewPresenter
            .present({ authConfig: integrationInstanceProvider.authConfig }, opts)
            .run()
        : null,
      integration_provider: integrationProvider,
      created_at: integrationInstanceProvider.createdAt,
      updated_at: integrationInstanceProvider.updatedAt,
      archived_at: integrationInstanceProvider.archivedAt
    };
  })
  .schema(
    v.object({
      object: v.literal('magic_mcp.server.provider'),
      id: v.string(),
      status: v.enumOf(['active', 'archived', 'deleted']),
      magic_mcp_server_id: v.string(),
      integration_id: v.string(),
      integration_instance_id: v.string(),
      integration_provider_id: v.string(),
      name: v.string(),
      description: v.nullable(v.string()),
      metadata: v.nullable(v.record(v.any())),
      tool_filter: v.nullable(toolFilterPresenter.schema),
      is_override_tool_filter: v.boolean(),
      provider: v1ProviderPreview.schema,
      deployment: v1ProviderDeploymentPreviewPresenter.schema,
      auth_method: v.nullable(v1ProviderAuthMethodPresenter.schema),
      auth_credentials: v.nullable(v1ProviderAuthCredentialsPresenter.schema),
      config: v.nullable(v1ProviderConfigPreviewPresenter.schema),
      auth_config: v.nullable(v1ProviderAuthConfigPreviewPresenter.schema),
      integration_provider: v1IntegrationProviderSnapshot.schema,
      created_at: v.date(),
      updated_at: v.date(),
      archived_at: v.nullable(v.date())
    })
  )
  .build();
