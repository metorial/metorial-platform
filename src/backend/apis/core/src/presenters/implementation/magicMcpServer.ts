import { getConfig } from '@metorial/config';
import { Presenter } from '@metorial/presenter';
import { shadowId } from '@metorial/shadow-id';
import { v } from '@metorial/validation';
import { magicMcpServerType } from '../types';

let sessionTemplateSchema = v.object({
  id: v.string({
    name: 'id',
    description: 'The unique identifier of the session template used by this magic MCP server'
  }),
  name: v.nullable(
    v.string({
      name: 'name',
      description: 'The display name of the linked session template'
    })
  ),
  description: v.nullable(
    v.string({
      name: 'description',
      description: 'The description of the linked session template'
    })
  )
});

export let v1MagicMcpServerPresenter = Presenter.create(magicMcpServerType)
  .presenter(async ({ magicMcpServer }) => {
    return {
      object: 'magic_mcp.server',

      id: magicMcpServer.id,
      status: magicMcpServer.status,

      session_template: magicMcpServer.sessionTemplate ?? {
        id: magicMcpServer.subspaceSessionTemplateId,
        name: null,
        description: null
      },

      endpoints: magicMcpServer.aliases.map(a => ({
        id: shadowId('mgsep_', [magicMcpServer.id], [a.oid]),
        alias: a.slug,
        urls: {
          sse: `${getConfig().urls.mcpUrl}/magic/${a.slug}/sse`,
          streamable_http: `${getConfig().urls.mcpUrl}/magic/${a.slug}/mcp`
        }
      })),

      name: magicMcpServer.name,
      description: magicMcpServer.description,
      metadata: magicMcpServer.metadata,

      created_at: magicMcpServer.createdAt,
      updated_at: magicMcpServer.updatedAt
    };
  })
  .schema(
    v.object({
      object: v.literal('magic_mcp.server'),

      id: v.string({
        name: 'id',
        description: 'The unique identifier of the magic MCP server'
      }),

      status: v.enumOf(['active', 'archived', 'deleted'], {
        name: 'status',
        description: 'The status of the magic MCP server'
      }),

      session_template: sessionTemplateSchema,

      endpoints: v.array(
        v.object({
          id: v.string({
            name: 'id',
            description: 'The unique identifier of the magic MCP server endpoint'
          }),
          alias: v.string({
            name: 'alias',
            description: 'The alias associated with the magic MCP server endpoint'
          }),
          urls: v.object(
            {
              sse: v.string({
                name: 'sse',
                description: 'The SSE URL for the magic MCP server endpoint'
              }),
              streamable_http: v.string({
                name: 'streamable_http',
                description: 'The Streamable HTTP URL for the magic MCP server endpoint'
              })
            },
            {
              name: 'urls',
              description: 'The connection URLs for the magic MCP server endpoint'
            }
          )
        }),
        {
          name: 'endpoints',
          description: 'List of endpoints for accessing the magic MCP server'
        }
      ),

      name: v.nullable(
        v.string({
          name: 'name',
          description: 'The name of the magic MCP server'
        })
      ),
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

export let v1DashboardMagicMcpServerPresenter = Presenter.create(magicMcpServerType)
  .presenter(async ({ magicMcpServer }, opts) => {
    return await v1MagicMcpServerPresenter.present({ magicMcpServer }, opts).run({});
  })
  .schema(v1MagicMcpServerPresenter.schema)
  .build();
