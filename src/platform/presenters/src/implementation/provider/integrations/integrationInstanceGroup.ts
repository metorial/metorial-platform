import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { presentOwnerActor, presentResourceSource, resourceAccessSchema } from '../../_shared';
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
    implementation: integrationInstanceGroup.magicMcpEndpointBacking
      ? {
          type: 'magic_mcp_endpoint' as const,
          magic_mcp_endpoint_id: integrationInstanceGroup.magicMcpEndpointBacking.id
        }
      : null,
    providers: await Promise.all(
      integrationInstanceGroup.providers.map(integrationInstanceGroupProvider =>
        v1IntegrationInstanceGroupProviderPresenter
          .present({ integrationInstanceGroupProvider }, opts)
          .run()
      )
    ),
    access: {
      source: presentResourceSource(integrationInstanceGroup.source),
      type: integrationInstanceGroup.isOwnerLocked
        ? ('owner_locked' as const)
        : ('public' as const),
      visibility: integrationInstanceGroup.isOwnerOnlyVisible
        ? ('owner' as const)
        : ('anyone' as const),
      owner: presentOwnerActor(
        integrationInstanceGroup.ownerActor ?? integrationInstanceGroup.identityActor
      )
    },
    created_at: integrationInstanceGroup.createdAt,
    updated_at: integrationInstanceGroup.updatedAt,
    archived_at: integrationInstanceGroup.archivedAt
  }))
  .schema(
    v.object({
      object: v.literal('integration.instance.group', {
        description: 'String representing the object’s type.'
      }),
      id: v.string({
        description: 'Unique ID.',
        examples: ['dii_4dEfGhJkLmNpQrSt']
      }),
      status: v.enumOf(['draft', 'active', 'archived', 'deleted'], {
        description: '`draft` when created. `archived` once you archive the group.'
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
      implementation: v.nullable(
        v.object(
          {
            type: v.literal('magic_mcp_endpoint', {
              description: 'Which kind of backing this is.'
            }),
            magic_mcp_endpoint_id: v.string({
              description: 'Magic MCP endpoint backing this group.'
            })
          },
          { description: 'What backs this group. `null` for a standalone group.' }
        )
      ),
      providers: v.array(v1IntegrationInstanceGroupProviderPresenter.schema, {
        description: 'Providers linked into this group.'
      }),
      access: resourceAccessSchema,
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
