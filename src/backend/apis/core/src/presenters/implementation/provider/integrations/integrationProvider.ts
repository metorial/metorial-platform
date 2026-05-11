import { v } from '@lowerdeck/validation';
import { SubspaceIntegrationInstanceProviderSnapshot } from '@metorial/module-subspace';
import { Presenter } from '@metorial/presenter';
import { integrationProviderType } from '../../../types';
import { toolFilterPresenter } from '../../_shared/toolFilter';
import { v1ProviderAuthCredentialsPresenter } from '../auth/authCredentials';
import { v1ProviderAuthMethodPresenter } from '../auth/authMethod';
import { v1ProviderConfigPreviewPresenter } from '../config/configPreview';
import { v1ProviderDeploymentPreviewPresenter } from '../config/deploymentPreview';
import { v1ProviderPreview } from '../core/providerPreview';

let presentToolFilter = (toolFilter: PrismaJson.ToolFilter | null | undefined) =>
  toolFilter ? toolFilterPresenter(toolFilter as any) : null;

export let v1IntegrationProviderSnapshot = Object.assign(
  async (integrationProvider: SubspaceIntegrationInstanceProviderSnapshot, opts?: any) => {
    return {
      object: 'integration.provider#snapshot' as const,
      id: integrationProvider.id,

      provider_version: {
        object: 'integration.provider.version' as const,
        id: integrationProvider.providerVersionId,
        index: integrationProvider.index
      },

      status: integrationProvider.status,
      name: integrationProvider.name,
      description: integrationProvider.description,
      metadata: integrationProvider.metadata,
      tool_filter: presentToolFilter(integrationProvider.toolFilter),
      provider: v1ProviderPreview(integrationProvider.provider),
      deployment: await v1ProviderDeploymentPreviewPresenter
        .present({ deployment: integrationProvider.deployment }, opts)
        .run(),
      auth_method: integrationProvider.authMethod
        ? await v1ProviderAuthMethodPresenter
            .present({ authMethod: integrationProvider.authMethod }, opts)
            .run()
        : null,
      auth_credentials: integrationProvider.authCredentials
        ? await v1ProviderAuthCredentialsPresenter
            .present({ authCredentials: integrationProvider.authCredentials }, opts)
            .run()
        : null,
      config: integrationProvider.config
        ? await v1ProviderConfigPreviewPresenter
            .present({ config: integrationProvider.config }, opts)
            .run()
        : null,
      created_at: integrationProvider.createdAt,
      updated_at: integrationProvider.updatedAt,
      archived_at: integrationProvider.archivedAt
    };
  },
  {
    schema: v.object({
      object: v.literal('integration.provider#snapshot'),
      id: v.string(),
      provider_version: v.object({
        object: v.literal('integration.provider.version'),
        id: v.string(),
        index: v.number()
      }),
      status: v.enumOf(['active', 'archived', 'deleted']),
      name: v.string(),
      description: v.nullable(v.string()),
      metadata: v.nullable(v.record(v.any())),
      tool_filter: v.nullable(toolFilterPresenter.schema),
      provider: v1ProviderPreview.schema,
      deployment: v1ProviderDeploymentPreviewPresenter.schema,
      auth_method: v.nullable(v1ProviderAuthMethodPresenter.schema),
      auth_credentials: v.nullable(v1ProviderAuthCredentialsPresenter.schema),
      config: v.nullable(v1ProviderConfigPreviewPresenter.schema),
      created_at: v.date(),
      updated_at: v.date(),
      archived_at: v.nullable(v.date())
    })
  }
);

export let v1IntegrationProviderPresenter = Presenter.create(integrationProviderType)
  .presenter(async ({ integrationProvider }, opts) => ({
    object: 'integration.provider' as const,
    id: integrationProvider.id,
    status: integrationProvider.status,
    integration_id: integrationProvider.integrationId,
    name: integrationProvider.name,
    description: integrationProvider.description,
    metadata: integrationProvider.metadata,
    tool_filter: presentToolFilter(integrationProvider.toolFilter),
    provider: v1ProviderPreview(integrationProvider.provider),
    deployment: await v1ProviderDeploymentPreviewPresenter
      .present({ deployment: integrationProvider.deployment }, opts)
      .run(),
    auth_method: integrationProvider.authMethod
      ? await v1ProviderAuthMethodPresenter
          .present({ authMethod: integrationProvider.authMethod }, opts)
          .run()
      : null,
    auth_credentials: integrationProvider.authCredentials
      ? await v1ProviderAuthCredentialsPresenter
          .present({ authCredentials: integrationProvider.authCredentials }, opts)
          .run()
      : null,
    config: integrationProvider.config
      ? await v1ProviderConfigPreviewPresenter
          .present({ config: integrationProvider.config }, opts)
          .run()
      : null,
    created_at: integrationProvider.createdAt,
    updated_at: integrationProvider.updatedAt,
    archived_at: integrationProvider.archivedAt
  }))
  .schema(
    v.object({
      object: v.literal('integration.provider'),
      id: v.string(),
      status: v.enumOf(['active', 'archived', 'deleted']),
      integration_id: v.string(),
      name: v.string(),
      description: v.nullable(v.string()),
      metadata: v.nullable(v.record(v.any())),
      tool_filter: v.nullable(toolFilterPresenter.schema),
      provider: v1ProviderPreview.schema,
      deployment: v1ProviderDeploymentPreviewPresenter.schema,
      auth_method: v.nullable(v1ProviderAuthMethodPresenter.schema),
      auth_credentials: v.nullable(v1ProviderAuthCredentialsPresenter.schema),
      config: v.nullable(v1ProviderConfigPreviewPresenter.schema),
      created_at: v.date(),
      updated_at: v.date(),
      archived_at: v.nullable(v.date())
    })
  )
  .build();
