import { v } from '@mtsrc/validation';
import { SubspaceIntegrationInstanceProviderSnapshot } from '@metorial/module-subspace';
import { Presenter } from '@metorial/presenter';
import { integrationProviderType } from '../../../types';
import { toolFilterPresenter } from '../../_shared/toolFilter';
import { v1ProviderAuthCredentialsPresenter, v1ProviderAuthMethodPresenter } from '../auth';
import {
  v1ProviderConfigPreviewPresenter,
  v1ProviderDeploymentPreviewPresenter
} from '../config';
import { v1ProviderPreview } from '../provider';

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
      provider_id: integrationProvider.provider.id,
      deployment_id: integrationProvider.deployment.id,
      auth_method_id: integrationProvider.authMethod?.id ?? null,
      auth_credentials_id: integrationProvider.authCredentials?.id ?? null,
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
      provider_id: v.string(),
      deployment_id: v.string(),
      auth_method_id: v.nullable(v.string()),
      auth_credentials_id: v.nullable(v.string()),
      config: v.nullable(v1ProviderConfigPreviewPresenter.schema),
      created_at: v.date(),
      updated_at: v.date(),
      archived_at: v.nullable(v.date())
    })
  }
);

export let dashboardIntegrationProviderSnapshot = Object.assign(
  async (integrationProvider: SubspaceIntegrationInstanceProviderSnapshot, opts?: any) => {
    let inner = await v1IntegrationProviderSnapshot(integrationProvider, opts);

    return {
      ...inner,

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
        : null
    };
  },
  {
    schema: v.object({
      ...v1IntegrationProviderSnapshot.schema.properties,
      provider: v1ProviderPreview.schema,
      deployment: v1ProviderDeploymentPreviewPresenter.schema,
      auth_method: v.nullable(v1ProviderAuthMethodPresenter.schema),
      auth_credentials: v.nullable(v1ProviderAuthCredentialsPresenter.schema)
    }) as any
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
    provider_id: integrationProvider.provider.id,
    deployment_id: integrationProvider.deployment.id,
    auth_method_id: integrationProvider.authMethod?.id ?? null,
    auth_credentials_id: integrationProvider.authCredentials?.id ?? null,
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
      provider_id: v.string(),
      deployment_id: v.string(),
      auth_method_id: v.nullable(v.string()),
      auth_credentials_id: v.nullable(v.string()),
      config: v.nullable(v1ProviderConfigPreviewPresenter.schema),
      created_at: v.date(),
      updated_at: v.date(),
      archived_at: v.nullable(v.date())
    })
  )
  .build();

export let dashboardIntegrationProviderPresenter = Presenter.create(integrationProviderType)
  .presenter(async ({ integrationProvider }, opts) => {
    let inner = await v1IntegrationProviderPresenter
      .present({ integrationProvider }, opts)
      .run();

    return {
      ...inner,
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
        : null
    };
  })
  .schema(
    v.object({
      ...v1IntegrationProviderPresenter.schema.properties,
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
      auth_credentials: v.nullable(v1ProviderAuthCredentialsPresenter.schema)
    }) as any
  )
  .build();
