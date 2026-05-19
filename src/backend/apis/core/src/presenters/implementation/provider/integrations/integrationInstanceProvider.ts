import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { integrationInstanceProviderType } from '../../../types';
import { toolFilterPresenter } from '../../_shared/toolFilter';
import { v1ProviderAuthConfigPreviewPresenter } from '../auth/authConfigPreview';
import { v1ProviderConfigPreviewPresenter } from '../config/configPreview';
import { v1ProviderPreview } from '../provider';
import {
  dashboardIntegrationProviderSnapshot,
  v1IntegrationProviderSnapshot
} from './integrationProvider';

let presentToolFilter = (toolFilter: PrismaJson.ToolFilter | null | undefined) =>
  toolFilter ? toolFilterPresenter(toolFilter as any) : null;

export let v1IntegrationInstanceProviderPresenter = Presenter.create(
  integrationInstanceProviderType
)
  .presenter(async ({ integrationInstanceProvider }, opts) => ({
    object: 'integration.instance.provider' as const,
    id: integrationInstanceProvider.id,
    status: integrationInstanceProvider.status,
    name: integrationInstanceProvider.name,
    description: integrationInstanceProvider.description,
    metadata: integrationInstanceProvider.metadata,
    integration_id: integrationInstanceProvider.integrationId,
    integration_instance_id: integrationInstanceProvider.integrationInstanceId,
    tool_filter: presentToolFilter(integrationInstanceProvider.toolFilter),
    is_override_tool_filter: integrationInstanceProvider.isOverrideToolFilter,
    provider: v1ProviderPreview(integrationInstanceProvider.provider),
    integration_provider: await v1IntegrationProviderSnapshot(
      integrationInstanceProvider.integrationProvider,
      opts
    ),
    config: integrationInstanceProvider.config
      ? await v1ProviderConfigPreviewPresenter
          .present({ config: integrationInstanceProvider.config }, opts)
          .run()
      : null,
    auth_config: integrationInstanceProvider.authConfig
      ? await v1ProviderAuthConfigPreviewPresenter
          .present({ authConfig: integrationInstanceProvider.authConfig }, opts)
          .run()
      : null,
    created_at: integrationInstanceProvider.createdAt,
    updated_at: integrationInstanceProvider.updatedAt,
    archived_at: integrationInstanceProvider.archivedAt
  }))
  .schema(
    v.object({
      object: v.literal('integration.instance.provider'),
      id: v.string(),
      status: v.enumOf(['active', 'archived', 'deleted']),
      name: v.string(),
      description: v.nullable(v.string()),
      metadata: v.nullable(v.record(v.any())),
      integration_id: v.string(),
      integration_instance_id: v.string(),
      tool_filter: v.nullable(toolFilterPresenter.schema),
      is_override_tool_filter: v.boolean(),
      provider: v1ProviderPreview.schema,
      integration_provider: v1IntegrationProviderSnapshot.schema,
      config: v.nullable(v1ProviderConfigPreviewPresenter.schema),
      auth_config: v.nullable(v1ProviderAuthConfigPreviewPresenter.schema),
      created_at: v.date(),
      updated_at: v.date(),
      archived_at: v.nullable(v.date())
    })
  )
  .build();

export let dashboardIntegrationInstanceProviderPresenter = Presenter.create(
  integrationInstanceProviderType
)
  .presenter(async ({ integrationInstanceProvider }, opts) => {
    let inner = await v1IntegrationInstanceProviderPresenter
      .present({ integrationInstanceProvider }, opts)
      .run();

    return {
      ...inner,
      integration_provider: await dashboardIntegrationProviderSnapshot(
        integrationInstanceProvider.integrationProvider,
        opts
      )
    };
  })
  .schema(
    v.intersection([
      v1IntegrationInstanceProviderPresenter.schema,
      v.object({
        integration_provider: v1IntegrationProviderSnapshot.schema
      })
    ])
  )
  .build();
