import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { magicMcpGroupType } from '../types';

export let v1MagicMcpGroupPresenter = Presenter.create(magicMcpGroupType)
  .presenter(async ({ magicMcpGroup }, opts) => {
    return {
      object: 'magic_mcp.group',

      id: magicMcpGroup.id,
      status: magicMcpGroup.status,

      slug: magicMcpGroup.slug,
      name: magicMcpGroup.name,
      description: magicMcpGroup.description,
      metadata: magicMcpGroup.metadata,

      created_at: magicMcpGroup.createdAt,
      updated_at: magicMcpGroup.updatedAt
    };
  })
  .schema(
    v.object({
      object: v.literal('magic_mcp.group', {
        description: "String representing the object's type"
      }),

      id: v.string({
        name: 'id',
        description: 'The unique identifier of the magic MCP group'
      }),

      status: v.enumOf(['active', 'deleted'], {
        name: 'status',
        description: 'The status of the magic MCP server'
      }),

      slug: v.string({
        name: 'slug',
        description: 'The slug identifier of the magic MCP group'
      }),

      name: v.string({
        name: 'name',
        description: 'The name of the magic MCP server'
      }),
      description: v.nullable(
        v.string({
          name: 'description',
          description: 'A description of the magic MCP server, if available'
        })
      ),

      metadata: v.record(v.any(), {
        name: 'metadata',
        description: 'Additional metadata related to the magic MCP server'
      }),

      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when the magic MCP server was created'
      }),
      updated_at: v.date({
        name: 'updated_at',
        description: 'Timestamp when the magic MCP server was last updated'
      })
    })
  )
  .build();
