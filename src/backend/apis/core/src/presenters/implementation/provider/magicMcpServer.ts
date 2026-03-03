import { getConfig } from '@metorial/config';
import { shadowId } from '@lowerdeck/shadow-id';
import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { magicMcpServerType } from '../../types';

export let v1MagicMcpServerPresenter = Presenter.create(magicMcpServerType)
  .presenter(async ({ magicMcpServer }) => ({
    object: 'magic_mcp.server' as const,
    id: magicMcpServer.id,
    status: magicMcpServer.status,
    session_template_id: magicMcpServer.subspaceSessionTemplateId,
    endpoints: magicMcpServer.aliases.map(a => ({
      id: shadowId('mgse_', [magicMcpServer.id], [a.slug]),
      alias: a.slug,
      url: `${getConfig().urls.mcpUrl}/magic/${a.slug}`
    })),
    name: magicMcpServer.name,
    description: magicMcpServer.description,
    metadata: magicMcpServer.metadata,
    created_at: magicMcpServer.createdAt,
    updated_at: magicMcpServer.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('magic_mcp.server'),
      id: v.string(),
      status: v.enumOf(['active', 'archived', 'deleted']),
      session_template_id: v.string(),
      endpoints: v.array(
        v.object({
          id: v.string(),
          alias: v.string(),
          url: v.string()
        })
      ),
      name: v.nullable(v.string()),
      description: v.nullable(v.string()),
      metadata: v.record(v.any()),
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();
