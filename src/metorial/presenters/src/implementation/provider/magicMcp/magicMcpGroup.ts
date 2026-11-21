import { Presenter } from '@metorial/presenter';
import { v } from '@lowerdeck/validation';
import { magicMcpGroupType } from '../../../types';

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
      object: v.literal('magic_mcp.group', {
        description: 'String representing the object’s type.'
      }),
      id: v.string({ description: 'Unique ID.' }),
      status: v.enumOf(['active', 'deleted', 'archived'], {
        description: '`deleted` once you delete the group.'
      }),
      slug: v.string({
        description: 'URL-safe name, unique within the instance.'
      }),
      name: v.nullable(v.string({ description: 'Display name.' })),
      description: v.nullable(v.string({ description: 'Free-text description.' })),
      metadata: v.record(v.any(), {
        description: 'Custom data you attach to identify or organize this record.'
      }),
      created_at: v.date({ description: 'Creation time.' }),
      updated_at: v.date({ description: 'Last update time.' })
    })
  )
  .build();
