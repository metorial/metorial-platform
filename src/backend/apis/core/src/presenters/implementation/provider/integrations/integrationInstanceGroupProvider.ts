import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { integrationInstanceGroupProviderType } from '../../../types';
import { toolFilterPresenter } from '../../_shared/toolFilter';
import { v1ProviderPreview } from '../provider';
import { v1IntegrationInstanceProviderPresenter } from './integrationInstanceProvider';
import {
  dashboardIntegrationProviderSnapshot,
  v1IntegrationProviderSnapshot
} from './integrationProvider';

let presentToolFilter = (toolFilter: PrismaJson.ToolFilter | null | undefined) =>
  toolFilter ? toolFilterPresenter(toolFilter as any) : null;

export let v1IntegrationInstanceGroupProviderPresenter = Presenter.create(
  integrationInstanceGroupProviderType
)
  .presenter(async ({ integrationInstanceGroupProvider }, opts) => ({
    object: 'integration.instance.group.provider' as const,
    id: integrationInstanceGroupProvider.id,
    status: integrationInstanceGroupProvider.status,
    name: integrationInstanceGroupProvider.name,
    description: integrationInstanceGroupProvider.description,
    metadata: integrationInstanceGroupProvider.metadata,

    integration_id: integrationInstanceGroupProvider.integrationId,
    integration_instance_group_id: integrationInstanceGroupProvider.integrationInstanceGroupId,
    integration_instance_id: integrationInstanceGroupProvider.integrationInstanceId,
    integration_provider_id: integrationInstanceGroupProvider.integrationProvider?.id ?? null,
    integration_instance_provider_id:
      integrationInstanceGroupProvider.integrationInstanceProvider.id,

    tool_filter: presentToolFilter(integrationInstanceGroupProvider.toolFilter),
    is_override_tool_filter: integrationInstanceGroupProvider.isOverrideToolFilter,

    created_at: integrationInstanceGroupProvider.createdAt,
    updated_at: integrationInstanceGroupProvider.updatedAt,
    archived_at: integrationInstanceGroupProvider.archivedAt
  }))
  .schema(
    v.object({
      object: v.literal('integration.instance.group.provider'),
      id: v.string(),
      status: v.enumOf(['active', 'archived', 'deleted']),
      name: v.string(),
      description: v.nullable(v.string()),
      metadata: v.nullable(v.record(v.any())),

      integration_id: v.string(),
      integration_instance_group_id: v.string(),
      integration_instance_id: v.string(),
      integration_provider_id: v.nullable(v.string()),
      integration_instance_provider_id: v.string(),

      tool_filter: v.nullable(toolFilterPresenter.schema),
      is_override_tool_filter: v.boolean(),

      created_at: v.date(),
      updated_at: v.date(),
      archived_at: v.nullable(v.date())
    })
  )
  .build();

export let dashboardIntegrationInstanceGroupProviderPresenter = Presenter.create(
  integrationInstanceGroupProviderType
)
  .presenter(async ({ integrationInstanceGroupProvider }, opts) => {
    let inner = await v1IntegrationInstanceGroupProviderPresenter
      .present({ integrationInstanceGroupProvider }, opts)
      .run();

    return {
      ...inner,

      provider: v1ProviderPreview(integrationInstanceGroupProvider.provider),
      integration_provider: integrationInstanceGroupProvider.integrationProvider
        ? await dashboardIntegrationProviderSnapshot(
            integrationInstanceGroupProvider.integrationProvider,
            opts
          )
        : null,
      integration_instance_provider: await v1IntegrationInstanceProviderPresenter
        .present(
          {
            integrationInstanceProvider:
              integrationInstanceGroupProvider.integrationInstanceProvider
          },
          opts
        )
        .run()
    };
  })
  .schema(
    v.intersection([
      v1IntegrationInstanceGroupProviderPresenter.schema,
      v.object({
        provider: v1ProviderPreview.schema,
        integration_provider: v.nullable(v1IntegrationProviderSnapshot.schema),
        integration_instance_provider: v1IntegrationInstanceProviderPresenter.schema
      })
    ])
  )
  .build();
