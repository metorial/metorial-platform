import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { magicMcpServerType } from '../types';
import { v1ServerDeploymentPreview } from './serverDeploymentPreview';

export let v1MagicMcpServerPresenter = Presenter.create(magicMcpServerType)
  .presenter(async ({ magicMcpServer }, opts) => {
    return {
      object: 'magic_mcp.server',

      id: magicMcpServer.id,
      status: magicMcpServer.status,

      server_deployments: [
        v1ServerDeploymentPreview(
          magicMcpServer.serverDeployment.serverDeployment,
          magicMcpServer.serverDeployment.serverDeployment.server
        )
      ],

      aliases: magicMcpServer.aliases.map(a => a.slug),

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
        description: 'The unique identifier of the session'
      }),

      status: v.enumOf(['active', 'archived', 'deleted'], {
        name: 'status',
        description: 'The status of the magic MCP server'
      }),

      aliases: v.array(v.string(), {
        name: 'aliases',
        description: 'List of aliases associated with the magic MCP server'
      }),

      server_deployments: v.array(v1ServerDeploymentPreview.schema, {
        name: 'server_deployments',
        description: 'List of server deployments associated with the magic MCP server'
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
