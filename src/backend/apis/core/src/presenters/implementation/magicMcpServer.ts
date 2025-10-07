import { getConfig } from '@metorial/config';
import { Presenter } from '@metorial/presenter';
import { shadowId } from '@metorial/shadow-id';
import { v } from '@metorial/validation';
import { magicMcpServerType } from '../types';
import { v1ServerDeploymentPreview } from './serverDeploymentPreview';

export let v1MagicMcpServerPresenter = Presenter.create(magicMcpServerType)
  .presenter(async ({ magicMcpServer }, opts) => {
    return {
      object: 'magic_mcp.server',

      id: magicMcpServer.id,
      status: magicMcpServer.status,

      server_deployments: magicMcpServer.serverDeployment
        ? [
            v1ServerDeploymentPreview(
              magicMcpServer.serverDeployment.serverDeployment,
              magicMcpServer.serverDeployment.serverDeployment.server
            )
          ]
        : [],

      endpoints: magicMcpServer.aliases.map(a => ({
        id: shadowId('mgsep_', [magicMcpServer.id], [a.oid]),
        alias: a.slug,
        urls: {
          sse: `${getConfig().urls.mcpUrl}/magic/${a.slug}/sse`,
          streamable_http: `${getConfig().urls.mcpUrl}/magic/${a.slug}/mcp`
          // websocket: `${getConfig().urls.mcpUrl}/magic/${a.slug}/websocket`
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
        description: 'The unique identifier of the session'
      }),

      status: v.enumOf(['active', 'archived', 'deleted'], {
        name: 'status',
        description: 'The status of the magic MCP server'
      }),

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
              // websocket: v.string({
              //   name: 'websocket',
              //   description: 'The WebSocket URL for the magic MCP server endpoint'
              // })
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

export let v1DashboardMagicMcpServerPresenter = Presenter.create(magicMcpServerType)
  .presenter(async ({ magicMcpServer }, opts) => {
    let inner = await v1MagicMcpServerPresenter.present({ magicMcpServer }, opts).run({});

    return {
      ...inner,

      needs_default_oauth_session:
        !magicMcpServer.defaultServerOauthSession &&
        !!magicMcpServer.serverDeployment?.serverDeployment.oauthConnectionOid,

      default_oauth_session: magicMcpServer.defaultServerOauthSession
        ? {
            object: 'server.oauth_session#preview',
            id: magicMcpServer.defaultServerOauthSession.id,
            status: magicMcpServer.defaultServerOauthSession.status,
            metadata: magicMcpServer.defaultServerOauthSession.metadata,
            created_at: magicMcpServer.defaultServerOauthSession.createdAt,
            updated_at: magicMcpServer.defaultServerOauthSession.updatedAt
          }
        : null
    };
  })
  .schema(
    v.intersection([
      v1MagicMcpServerPresenter.schema,
      v.object({
        needs_default_oauth_session: v.boolean({
          name: 'needs_default_oauth_session',
          description:
            'Indicates whether a default OAuth session is needed for this magic MCP server'
        }),

        default_oauth_session: v.nullable(
          v.object({
            object: v.literal('server.oauth_session#preview'),
            id: v.string({
              name: 'id',
              description: 'The unique identifier of the OAuth session'
            }),
            status: v.enumOf(['active', 'archived', 'deleted'], {
              name: 'status',
              description: 'The status of the OAuth session'
            }),
            metadata: v.record(v.any(), {
              name: 'metadata',
              description: 'Additional metadata related to the OAuth session'
            }),
            created_at: v.date({
              name: 'created_at',
              description: 'Timestamp when the OAuth session was created'
            }),
            updated_at: v.date({
              name: 'updated_at',
              description: 'Timestamp when the OAuth session was last updated'
            })
          })
        )
      })
    ]) as any
  )
  .build();
