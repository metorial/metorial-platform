import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { magicMcpTokenType } from '../../types';
import { v1MagicMcpGroupPresenter } from './magicMcpGroup';

export let v1MagicMcpTokenPresenter = Presenter.create(magicMcpTokenType)
  .presenter(async ({ magicMcpToken }, opts) => ({
    object: 'magic_mcp.token' as const,
    id: magicMcpToken.id,
    status: magicMcpToken.status,
    secret: magicMcpToken.secret,
    name: magicMcpToken.name,
    description: magicMcpToken.description,
    metadata: magicMcpToken.metadata,
    groups: await Promise.all(
      magicMcpToken.groups.map(g =>
        v1MagicMcpGroupPresenter.present({ magicMcpGroup: g.magicMcpGroup }, opts).run({})
      )
    ),
    created_at: magicMcpToken.createdAt,
    updated_at: magicMcpToken.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('magic_mcp.token'),
      id: v.string(),
      status: v.enumOf(['active', 'deleted']),
      secret: v.string(),
      name: v.nullable(v.string()),
      description: v.nullable(v.string()),
      groups: v.array(v1MagicMcpGroupPresenter.schema),
      metadata: v.record(v.any()),
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();
