import { shadowId } from '@lowerdeck/shadow-id';
import { v } from '@lowerdeck/validation';
import { getConfig } from '@metorial/config';
import { Presenter } from '@metorial/presenter';
import { magicMcpServerType } from '../../types';

export let v1MagicMcpServerPresenter = Presenter.create(magicMcpServerType)
  .presenter(async ({ magicMcpServer }) => ({
    object: 'magic_mcp.server' as const,
    id: magicMcpServer.id,
    status: magicMcpServer.status,
    source: magicMcpServer.source,
    provider_template_id: magicMcpServer.providerTemplateId,
    endpoints: magicMcpServer.aliases.map(a => ({
      id: shadowId('mgse_', [magicMcpServer.id], [a.slug]),
      alias: a.slug,
      url: `${getConfig().urls.apiUrl}/connect/magic/${a.slug}`
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
      source: v.enumOf(['manual', 'consumer_provider_template']),
      provider_template_id: v.nullable(v.string()),
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

export let dashboardMagicMcpServerPresenter = Presenter.create(magicMcpServerType)
  .presenter(async ({ magicMcpServer }, opts) => {
    let inner = await v1MagicMcpServerPresenter.present({ magicMcpServer }, opts).run();

    return {
      ...inner,
      session_template_id: magicMcpServer.subspaceSessionTemplateId,
      session_id: magicMcpServer.subspaceSession?.id ?? null
    };
  })
  .schema(
    v.intersection([
      v1MagicMcpServerPresenter.schema,
      v.object({
        session_template_id: v.string(),
        session_id: v.nullable(v.string())
      })
    ])
  )
  .build();
