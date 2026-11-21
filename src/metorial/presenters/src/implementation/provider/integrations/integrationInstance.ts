import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { presentOwnerActor, presentResourceSource, resourceAccessSchema } from '../../_shared';
import { integrationInstanceType } from '../../../types';
import {
  dashboardIntegrationInstanceProviderPresenter,
  v1IntegrationInstanceProviderPresenter
} from './integrationInstanceProvider';

export let v1IntegrationInstancePresenter = Presenter.create(integrationInstanceType)
  .presenter(async ({ integrationInstance }, opts) => ({
    object: 'integration.instance' as const,
    id: integrationInstance.id,
    status: integrationInstance.status,
    name: integrationInstance.name,
    description: integrationInstance.description,
    metadata: integrationInstance.metadata,
    integration_id: integrationInstance.integration.id,
    identity_actor_id: integrationInstance.identityActor?.id ?? null,
    identity_id: integrationInstance.identity?.id ?? null,
    access: {
      source: presentResourceSource(integrationInstance.source),
      type: integrationInstance.isOwnerLocked
        ? ('owner_locked' as const)
        : ('public' as const),
      visibility: integrationInstance.isOwnerOnlyVisible
        ? ('owner' as const)
        : ('anyone' as const),
      owner: presentOwnerActor(
        integrationInstance.ownerActor ?? integrationInstance.identityActor
      )
    },
    implementation: integrationInstance.magicMcpServerBackings[0]
      ? {
          type: 'magic_mcp_server' as const,
          magic_mcp_server_id: integrationInstance.magicMcpServerBackings[0].id
        }
      : null,
    providers: await Promise.all(
      integrationInstance.integrationInstanceProviders.map(integrationInstanceProvider =>
        v1IntegrationInstanceProviderPresenter
          .present({ integrationInstanceProvider }, opts)
          .run()
      )
    ),
    created_at: integrationInstance.createdAt,
    updated_at: integrationInstance.updatedAt,
    archived_at: integrationInstance.archivedAt
  }))
  .schema(
    v.object({
      object: v.literal('integration.instance', {
        description: 'String representing the object’s type.'
      }),
      id: v.string({
        description: 'Unique ID.',
        examples: ['ini_4dEfGhJkLmNpQrSt']
      }),
      status: v.enumOf(['draft', 'active', 'archived', 'deleted'], {
        description: '`draft` when created. `archived` once you archive the instance.'
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
        description: 'Integration this instance belongs to.',
        examples: ['int_2bCdEfGhJkLmNpQr']
      }),
      identity_actor_id: v.nullable(
        v.string({
          description: 'Identity actor the instance connects as. `null` when none is set.'
        })
      ),
      identity_id: v.nullable(
        v.string({
          description: 'Identity the instance connects as. `null` when none is set.'
        })
      ),
      access: resourceAccessSchema,
      implementation: v.nullable(
        v.object(
          {
            type: v.literal('magic_mcp_server', {
              description: 'Which kind of backing this is.'
            }),
            magic_mcp_server_id: v.string({
              description: 'Magic MCP server backing this instance.'
            })
          },
          { description: 'What backs this instance. `null` for a standalone instance.' }
        )
      ),
      providers: v.array(v1IntegrationInstanceProviderPresenter.schema, {
        description: 'Providers set up on this instance.'
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
    })
  )
  .build();

export let dashboardIntegrationInstancePresenter = Presenter.create(integrationInstanceType)
  .presenter(async ({ integrationInstance }, opts) => {
    let inner = await v1IntegrationInstancePresenter
      .present({ integrationInstance }, opts)
      .run();

    return {
      ...inner,
      is_oauth_compatible: integrationInstance.integrationInstanceProviders.every(
        integrationInstanceProvider => {
          let authMethod =
            integrationInstanceProvider.currentVersion?.authConfig?.authMethod ??
            integrationInstanceProvider.currentVersion?.integrationProviderVersion.authMethod;

          return !authMethod || authMethod.type === 'oauth';
        }
      ),
      providers: await Promise.all(
        integrationInstance.integrationInstanceProviders.map(integrationInstanceProvider =>
          dashboardIntegrationInstanceProviderPresenter
            .present({ integrationInstanceProvider }, opts)
            .run()
        )
      )
    };
  })
  .schema(
    v.object({
      ...v1IntegrationInstancePresenter.schema.properties,
      is_oauth_compatible: v.boolean({
        description: 'Whether every provider on the instance uses OAuth or no auth.'
      }),
      providers: v.array(dashboardIntegrationInstanceProviderPresenter.schema)
    }) as any
  )
  .build();
