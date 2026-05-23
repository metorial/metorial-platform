import { v } from '@mtsrc/validation';
import { Presenter } from '@metorial/presenter';
import { integrationInstanceGroupType } from '../../../types';
import { v1IntegrationInstanceGroupProviderPresenter } from './integrationInstanceGroupProvider';

export let v1IntegrationInstanceGroupPresenter = Presenter.create(integrationInstanceGroupType)
  .presenter(async ({ integrationInstanceGroup }, opts) => ({
    object: 'integration.instance.group' as const,
    id: integrationInstanceGroup.id,
    status: integrationInstanceGroup.status,
    name: integrationInstanceGroup.name,
    description: integrationInstanceGroup.description,
    metadata: integrationInstanceGroup.metadata,
    implementation: integrationInstanceGroup.magicMcpEndpointBackingId
      ? {
          type: 'magic_mcp_endpoint' as const,
          magic_mcp_endpoint_id: integrationInstanceGroup.magicMcpEndpointBackingId
        }
      : null,
    providers: await Promise.all(
      integrationInstanceGroup.providers.map(integrationInstanceGroupProvider =>
        v1IntegrationInstanceGroupProviderPresenter
          .present({ integrationInstanceGroupProvider }, opts)
          .run()
      )
    ),
    created_at: integrationInstanceGroup.createdAt,
    updated_at: integrationInstanceGroup.updatedAt,
    archived_at: integrationInstanceGroup.archivedAt
  }))
  .schema(
    v.object({
      object: v.literal('integration.instance.group'),
      id: v.string(),
      status: v.enumOf(['draft', 'active', 'archived', 'deleted']),
      name: v.string(),
      description: v.nullable(v.string()),
      metadata: v.nullable(v.record(v.any())),
      implementation: v.nullable(
        v.object({
          type: v.literal('magic_mcp_endpoint'),
          magic_mcp_endpoint_id: v.string()
        })
      ),
      providers: v.array(v1IntegrationInstanceGroupProviderPresenter.schema),
      created_at: v.date(),
      updated_at: v.date(),
      archived_at: v.nullable(v.date())
    })
  )
  .build();

export let dashboardIntegrationInstanceGroupPresenter = Presenter.create(
  integrationInstanceGroupType
)
  .presenter(async ({ integrationInstanceGroup }, opts) => {
    let inner = await v1IntegrationInstanceGroupPresenter
      .present({ integrationInstanceGroup }, opts)
      .run();

    return {
      ...inner,
      providers: await Promise.all(
        integrationInstanceGroup.providers.map(integrationInstanceGroupProvider =>
          v1IntegrationInstanceGroupProviderPresenter
            .present({ integrationInstanceGroupProvider }, opts)
            .run()
        )
      )
    };
  })
  .schema(
    v.object({
      ...v1IntegrationInstanceGroupPresenter.schema.properties,
      providers: v.array(v1IntegrationInstanceGroupProviderPresenter.schema)
    }) as any
  )
  .build();
