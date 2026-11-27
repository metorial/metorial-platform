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

    integration_id: integrationInstanceGroupProvider.integration.id,
    integration_instance_group_id:
      integrationInstanceGroupProvider.integrationInstanceGroup.id,
    integration_instance_id: integrationInstanceGroupProvider.integrationInstance.id,
    integration_provider_id: integrationInstanceGroupProvider.integrationProvider.id,
    integration_instance_provider_id:
      integrationInstanceGroupProvider.integrationInstanceProvider.id,

    tool_filter: presentToolFilter(
      integrationInstanceGroupProvider.toolFilter,
      integrationInstanceGroupProvider.isOverrideToolFilter
    ),
    is_override_tool_filter: integrationInstanceGroupProvider.isOverrideToolFilter,

    created_at: integrationInstanceGroupProvider.createdAt,
    updated_at: integrationInstanceGroupProvider.updatedAt,
    archived_at: integrationInstanceGroupProvider.archivedAt
  }))
  .schema(
    v.object({
      object: v.literal('integration.instance.group.provider', {
        description: 'String representing the object’s type.'
      }),
      id: v.string({
        description: 'Unique ID.',
        examples: ['dip_4dEfGhJkLmNpQrSt']
      }),
      status: v.enumOf(['active', 'archived', 'deleted'], {
        description: '`archived` once you archive the entry.'
      }),
      name: v.string({
        description: 'Display name.'
      }),
      description: v.nullable(
        v.string({
          description: 'Free-text description.'
        })
      ),
      metadata: v.nullable(
        v.record(v.any(), {
          description: 'Custom data you attach to identify or organize this record.'
        })
      ),

      integration_id: v.string({
        description: 'Integration this entry belongs to.',
        examples: ['int_2bCdEfGhJkLmNpQr']
      }),
      integration_instance_group_id: v.string({
        description: 'Group this entry belongs to.',
        examples: ['dii_4dEfGhJkLmNpQrSt']
      }),
      integration_instance_id: v.string({
        description: 'Instance this entry’s provider comes from.',
        examples: ['ini_4dEfGhJkLmNpQrSt']
      }),
      integration_provider_id: v.nullable(
        v.string({
          description:
            'Integration provider this entry was taken from. `null` when the entry has no integration provider.'
        })
      ),
      integration_instance_provider_id: v.string({
        description: 'Integration instance provider this entry links.',
        examples: ['iip_4dEfGhJkLmNpQrSt']
      }),

      tool_filter: v.nullable(toolFilterPresenter.schema),
      is_override_tool_filter: v.boolean({
        description: 'Replaces the integration tool filters instead of combining with them.'
      }),

      created_at: v.date({
        description: 'Creation time.'
      }),
      updated_at: v.date({
        description: 'Last update time.'
      }),
      archived_at: v.nullable(
        v.date({
          description: 'When this was archived. `null` while active.'
        })
      )
    }) as any
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

      provider: v1ProviderPreview(
        integrationInstanceGroupProvider.integrationProvider.provider
      ),
      integration_provider: integrationInstanceGroupProvider.integrationProvider.currentVersion
        ? await dashboardIntegrationProviderSnapshot(
            integrationInstanceGroupProvider.integrationProvider,
            integrationInstanceGroupProvider.integrationProvider.currentVersion,
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
    v.object({
      ...v1IntegrationInstanceGroupProviderPresenter.schema.properties,
      provider: v1ProviderPreview.schema,
      integration_provider: v.nullable(v1IntegrationProviderSnapshot.schema),
      integration_instance_provider: v1IntegrationInstanceProviderPresenter.schema
    }) as any
  )
  .build();
