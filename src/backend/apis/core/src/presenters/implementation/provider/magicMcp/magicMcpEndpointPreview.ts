import { v } from '@mtsrc/validation';
import { MagicMcpEndpoint } from '@metorial/db';

export let v1MagicMcpEndpointPreview = Object.assign(
  (magicMcpEndpoint: MagicMcpEndpoint) => ({
    object: 'magic_mcp.endpoint#preview' as const,
    id: magicMcpEndpoint.id,
    status: magicMcpEndpoint.status,
    slug: magicMcpEndpoint.slug,
    name: magicMcpEndpoint.name,
    description: magicMcpEndpoint.description
  }),
  {
    schema: v.object({
      object: v.literal('magic_mcp.endpoint#preview'),
      id: v.string(),
      status: v.enumOf(['active', 'archived', 'deleted']),
      slug: v.string(),
      name: v.nullable(v.string()),
      description: v.nullable(v.string())
    })
  }
);
