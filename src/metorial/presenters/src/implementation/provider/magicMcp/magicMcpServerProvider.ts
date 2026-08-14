import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { magicMcpServerProviderType } from '../../../types';
import { toolFilterPresenter } from '../../_shared/toolFilter';
import {
  v1ProviderAuthConfigPreviewPresenter,
  v1ProviderAuthCredentialsPresenter,
  v1ProviderAuthMethodPresenter
} from '../auth';
import {
  v1ProviderConfigPreviewPresenter,
  v1ProviderDeploymentPreviewPresenter
} from '../config';
import { v1ProviderPreview } from '../provider';

let presentToolFilter = (
  toolFilter: PrismaJson.ToolFilter | null | undefined,
  isOverrideToolFilter?: boolean
) =>
  toolFilter
    ? toolFilterPresenter({
        ...toolFilter,
        ignoreParentFilters: isOverrideToolFilter || undefined
      })
    : null;

export let v1MagicMcpServerProviderPresenter = Presenter.create(magicMcpServerProviderType)
  .presenter(async ({ magicMcpServer, magicMcpServerProvider }, opts) => {
    let instanceVersion = magicMcpServerProvider.integrationInstanceProvider?.currentVersion;
    let integrationVersion = magicMcpServerProvider.integrationProvider.currentVersion;
    if (!integrationVersion) {
      throw new Error(
        `Integration provider "${magicMcpServerProvider.integrationProvider.id}" has no current version to present.`
      );
    }
    let effectiveIntegrationVersion =
      instanceVersion?.integrationProviderVersion ?? integrationVersion;
    let provider = magicMcpServerProvider.integrationProvider.provider;
    let rawConfig = instanceVersion?.config ?? integrationVersion.config;
    let config = rawConfig
      ? await v1ProviderConfigPreviewPresenter
          .present({ config: { ...rawConfig, provider } }, opts)
          .run()
      : null;
    let providerManagementMode =
      magicMcpServerProvider.magicMcpServerBacking.ownerType === 'server_owned'
        ? ('manual' as const)
        : magicMcpServerProvider.magicMcpServerBacking.ownerType === 'integration'
          ? ('inherited_from_integration' as const)
          : ('inherited_from_provider_template' as const);

    return {
      object: 'magic_mcp.server.provider' as const,
      id: magicMcpServerProvider.id,
      status: magicMcpServerProvider.status,
      magic_mcp_server_id: magicMcpServer.id,
      provider_management_mode: providerManagementMode,
      name:
        magicMcpServerProvider.integrationInstanceProvider?.name ??
        magicMcpServerProvider.integrationProvider.name,
      description:
        magicMcpServerProvider.integrationInstanceProvider?.description ??
        magicMcpServerProvider.integrationProvider.description,
      metadata:
        magicMcpServerProvider.integrationInstanceProvider?.metadata ??
        magicMcpServerProvider.integrationProvider.metadata,
      tool_filter: presentToolFilter(
        (instanceVersion?.toolFilter ??
          integrationVersion.toolFilter) as PrismaJson.ToolFilter | null,
        instanceVersion?.isOverrideToolFilter
      ),
      provider: v1ProviderPreview(provider),
      deployment: await v1ProviderDeploymentPreviewPresenter
        .present(
          {
            deployment: {
              ...effectiveIntegrationVersion.deployment,
              provider
            }
          },
          opts
        )
        .run(),
      auth_method: effectiveIntegrationVersion.authMethod
        ? await v1ProviderAuthMethodPresenter
            .present(
              {
                authMethod: {
                  ...effectiveIntegrationVersion.authMethod,
                  provider
                }
              },
              opts
            )
            .run()
        : null,
      auth_credentials: effectiveIntegrationVersion.authCredentials
        ? await v1ProviderAuthCredentialsPresenter
            .present(
              {
                authCredentials: {
                  ...effectiveIntegrationVersion.authCredentials,
                  provider
                }
              },
              opts
            )
            .run()
        : null,
      config,
      auth_config: instanceVersion?.authConfig
        ? await v1ProviderAuthConfigPreviewPresenter
            .present(
              {
                authConfig: {
                  ...instanceVersion.authConfig,
                  providerId: provider.id
                }
              },
              opts
            )
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
