import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { magicMcpTokenType } from '../types';
import { v1MagicMcpGroupPresenter } from './magicMcpGroup';

export let v1MagicMcpTokenPresenter = Presenter.create(magicMcpTokenType)
  .presenter(async ({ magicMcpToken }, opts) => {
    return {
      object: 'magic_mcp.token',

      id: magicMcpToken.id,
      status: magicMcpToken.status,

      secret: magicMcpToken.secret,

      name: magicMcpToken.name,
      description: magicMcpToken.description,
      metadata: magicMcpToken.metadata,

      groups: await Promise.all(
        magicMcpToken.groups.map(async g =>
          v1MagicMcpGroupPresenter.present({ magicMcpGroup: g.magicMcpGroup }, opts).run({})
        )
      ),

      created_at: magicMcpToken.createdAt,
      updated_at: magicMcpToken.updatedAt
    };
  })
  .schema(
    v.object({
      object: v.literal('magic_mcp.token', { description: "String representing the object's type" }),

      id: v.string({
        name: 'id',
        description: 'The unique identifier of the magic MCP token'
      }),

      status: v.enumOf(['active', 'deleted'], {
        name: 'status',
        description: 'The status of the magic MCP server'
      }),

      secret: v.string({
        name: 'secret',
        description: 'The secret token used for authentication'
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

      groups: v.array(v1MagicMcpGroupPresenter.schema, {
        name: 'groups',
        description: 'The groups associated with the magic MCP token'
      }),

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
