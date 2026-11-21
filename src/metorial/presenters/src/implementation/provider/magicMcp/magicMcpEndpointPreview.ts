import { v } from '@lowerdeck/validation';
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
      object: v.literal('magic_mcp.endpoint#preview', {
        description: 'String representing the object’s type.'
      }),
      id: v.string({ description: 'Unique ID.' }),
      status: v.enumOf(['active', 'archived', 'deleted'], {
        description: '`archived` once the endpoint is deleted.'
      }),
      slug: v.string({ description: 'URL-safe name, unique within the instance.' }),
      name: v.nullable(v.string({ description: 'Display name.' })),
      description: v.nullable(v.string({ description: 'Free-text description.' }))
    })
  }
);
