import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { magicMcpServerProviderType } from '../../../types';
import { toolFilterPresenter } from '../../_shared/toolFilter';
import { v1ProviderAuthConfigPreviewPresenter } from '../auth/authConfigPreview';
import { v1ProviderAuthCredentialsPresenter } from '../auth/authCredentials';
import { v1ProviderAuthMethodPresenter } from '../auth/authMethod';
import { v1ProviderConfigPreviewPresenter } from '../config/configPreview';
import { v1ProviderDeploymentPreviewPresenter } from '../config/deploymentPreview';
import { v1IntegrationProviderSnapshot } from '../integrations/integrationProvider';
import { v1ProviderPreview } from '../core/providerPreview';

let presentToolFilter = (toolFilter: PrismaJson.ToolFilter | null | undefined) =>
  toolFilter ? toolFilterPresenter(toolFilter as any) : null;

export let v1MagicMcpServerProviderPresenter = Presenter.create(magicMcpServerProviderType)
  .presenter(async ({ magicMcpServer, magicMcpServerProvider }, opts) => {
    let integrationProvider = await v1IntegrationProviderSnapshot(
      magicMcpServerProvider.integrationProvider,
      opts
    );
    let config = magicMcpServerProvider.config
      ? await v1ProviderConfigPreviewPresenter
          .present({ config: magicMcpServerProvider.config }, opts)
          .run()
      : integrationProvider.config;
    let providerManagementMode =
      magicMcpServerProvider.ownerType === 'server_owned'
        ? ('manual' as const)
        : magicMcpServerProvider.ownerType === 'integration'
          ? ('inherited_from_integration' as const)
          : ('inherited_from_provider_template' as const);

    return {
      object: 'magic_mcp.server.provider' as const,
      id: magicMcpServerProvider.id,
      status: magicMcpServerProvider.status,
      magic_mcp_server_id: magicMcpServer.id,
      provider_management_mode: providerManagementMode,
      name: magicMcpServerProvider.name,
      description: magicMcpServerProvider.description,
      metadata: magicMcpServerProvider.metadata,
      tool_filter: presentToolFilter(magicMcpServerProvider.toolFilter),
      provider: v1ProviderPreview(magicMcpServerProvider.provider),
      deployment: integrationProvider.deployment,
      auth_method: integrationProvider.auth_method,
      auth_credentials: integrationProvider.auth_credentials,
      config,
      auth_config: magicMcpServerProvider.authConfig
        ? await v1ProviderAuthConfigPreviewPresenter
            .present({ authConfig: magicMcpServerProvider.authConfig }, opts)
            .run()
        : null,
      created_at: magicMcpServerProvider.createdAt,
      updated_at: magicMcpServerProvider.updatedAt,
      archived_at: magicMcpServerProvider.archivedAt
    };
  })
  .schema(
    v.object({
      object: v.literal('magic_mcp.server.provider'),
      id: v.string(),
      status: v.enumOf(['pending', 'active', 'archived', 'deleted']),
      magic_mcp_server_id: v.string(),
      provider_management_mode: v.enumOf([
        'manual',
        'inherited_from_provider_template',
        'inherited_from_integration'
      ]),
      name: v.string(),
      description: v.nullable(v.string()),
      metadata: v.nullable(v.record(v.any())),
      tool_filter: v.nullable(toolFilterPresenter.schema),
      provider: v1ProviderPreview.schema,
      deployment: v1ProviderDeploymentPreviewPresenter.schema,
      auth_method: v.nullable(v1ProviderAuthMethodPresenter.schema),
      auth_credentials: v.nullable(v1ProviderAuthCredentialsPresenter.schema),
      config: v.nullable(v1ProviderConfigPreviewPresenter.schema),
      auth_config: v.nullable(v1ProviderAuthConfigPreviewPresenter.schema),
      created_at: v.date(),
      updated_at: v.date(),
      archived_at: v.nullable(v.date())
    })
  )
  .build();

export let dashboardMagicMcpServerProviderPresenter = Presenter.create(
  magicMcpServerProviderType
)
  .presenter(async ({ magicMcpServer, magicMcpServerProvider }, opts) => {
    let inner = await v1MagicMcpServerProviderPresenter
      .present({ magicMcpServer, magicMcpServerProvider }, opts)
      .run();

    return {
      ...inner,

      can_update:
        magicMcpServerProvider.status !== 'archived' &&
        magicMcpServerProvider.status !== 'deleted',
      can_delete:
        inner.provider_management_mode === 'manual' &&
        magicMcpServerProvider.status !== 'archived' &&
        magicMcpServerProvider.status !== 'deleted'
    };
  })
  .schema(
    v.intersection([
      v1MagicMcpServerProviderPresenter.schema,
      v.object({
        can_update: v.boolean(),
        can_delete: v.boolean()
      })
    ])
  )
  .build();
