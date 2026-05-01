import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { integrationInstanceType } from '../../types';
import { v1IntegrationInstanceProviderPresenter } from './integrationInstanceProvider';

export let v1IntegrationInstancePresenter = Presenter.create(integrationInstanceType)
  .presenter(async ({ integrationInstance }, opts) => ({
    object: 'integration.instance' as const,
    id: integrationInstance.id,
    status: integrationInstance.status,
    name: integrationInstance.name,
    description: integrationInstance.description,
    metadata: integrationInstance.metadata,
    integration_id: integrationInstance.integrationId,
    identity_actor_id: integrationInstance.identityActorId,
    identity_id: integrationInstance.identityId,
    implementation: integrationInstance.magicMcpServerBackingId
      ? {
          type: 'magic_mcp_server' as const,
          magic_mcp_server_id: integrationInstance.magicMcpServerBackingId
        }
      : null,
    providers: await Promise.all(
      integrationInstance.providers.map(integrationInstanceProvider =>
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
      object: v.literal('integration.instance'),
      id: v.string(),
      status: v.enumOf(['draft', 'active', 'archived', 'deleted']),
      name: v.string(),
      description: v.nullable(v.string()),
      metadata: v.nullable(v.record(v.any())),
      integration_id: v.string(),
      identity_actor_id: v.nullable(v.string()),
      identity_id: v.nullable(v.string()),
      implementation: v.nullable(
        v.object({
          type: v.literal('magic_mcp_server'),
          magic_mcp_server_id: v.string()
        })
      ),
      providers: v.array(v1IntegrationInstanceProviderPresenter.schema),
      created_at: v.date(),
      updated_at: v.date(),
      archived_at: v.nullable(v.date())
    })
  )
  .build();
