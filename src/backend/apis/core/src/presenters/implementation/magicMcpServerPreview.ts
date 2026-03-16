import { v } from '@lowerdeck/validation';
import { MagicMcpServer } from '@metorial/db';

export let v1MagicMcpServerPreview = Object.assign(
  (magicMcpServer: MagicMcpServer) => ({
    object: 'magic_mcp.server#preview' as const,
    id: magicMcpServer.id,
    status: magicMcpServer.status,
    name: magicMcpServer.name,
    description: magicMcpServer.description
  }),
  {
    schema: v.object({
      object: v.literal('magic_mcp.server#preview'),
      id: v.string(),
      status: v.enumOf(['active', 'archived', 'deleted']),
      name: v.nullable(v.string()),
      description: v.nullable(v.string())
    })
  }
);
