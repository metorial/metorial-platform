import { v } from '@lowerdeck/validation';
import { getConfig } from '@metorial/config';
import { Presenter } from '@metorial/presenter';
import { magicMcpEndpointType } from '../../types';
import { v1MagicMcpServerPreview } from '../magicMcpServerPreview';

export let v1MagicMcpEndpointPresenter = Presenter.create(magicMcpEndpointType)
  .presenter(async ({ magicMcpEndpoint, portal }) => ({
    object: 'magic_mcp.endpoint' as const,
    id: magicMcpEndpoint.id,
    status: magicMcpEndpoint.status,
    slug: magicMcpEndpoint.slug,
    url: portal?.id
      ? `${getConfig().urls.apiUrl}/connect/portal/${portal.slug}/${magicMcpEndpoint.slug}`
      : `${getConfig().urls.apiUrl}/connect/magic/${magicMcpEndpoint.slug}`,
    consumer_profile_id: magicMcpEndpoint.consumerProfile?.id ?? null,
    servers: magicMcpEndpoint.servers.map(server =>
      v1MagicMcpServerPreview(server.magicMcpServer)
    ),
    name: magicMcpEndpoint.name,
    description: magicMcpEndpoint.description,
    metadata: magicMcpEndpoint.metadata,
    created_at: magicMcpEndpoint.createdAt,
    updated_at: magicMcpEndpoint.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('magic_mcp.endpoint'),
      id: v.string(),
      status: v.enumOf(['active', 'archived', 'deleted']),
      slug: v.string(),
      url: v.string(),
      consumer_profile_id: v.nullable(v.string()),
      session_template_id: v.nullable(v.string()),
      session_id: v.nullable(v.string()),
      servers: v.array(v1MagicMcpServerPreview.schema),
      name: v.nullable(v.string()),
      description: v.nullable(v.string()),
      metadata: v.record(v.any()),
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();
