import { Presenter } from '@metorial/presenter';
import { v } from '@lowerdeck/validation';
import { magicMcpGroupType } from '../../types';

export let v1MagicMcpGroupPresenter = Presenter.create(magicMcpGroupType)
  .presenter(async ({ magicMcpGroup }) => ({
    object: 'magic_mcp.group' as const,
    id: magicMcpGroup.id,
    status: magicMcpGroup.status,
    slug: magicMcpGroup.slug,
    name: magicMcpGroup.name,
    description: magicMcpGroup.description,
    metadata: magicMcpGroup.metadata,
    created_at: magicMcpGroup.createdAt,
    updated_at: magicMcpGroup.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('magic_mcp.group'),
      id: v.string(),
      status: v.enumOf(['active', 'deleted', 'archived']),
      slug: v.string(),
      name: v.nullable(v.string()),
      description: v.nullable(v.string()),
      metadata: v.record(v.any()),
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();
