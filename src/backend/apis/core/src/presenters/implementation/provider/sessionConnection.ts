import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { subspaceSessionConnectionType } from '../../types';

export let v1SubspaceSessionConnectionPresenter = Presenter.create(
  subspaceSessionConnectionType
)
  .presenter(async ({ sessionConnection }) => ({
    object: 'session.connection' as const,
    id: sessionConnection.id,
    status: sessionConnection.status,
    connection_state: sessionConnection.connectionState,
    mcp: {
      object: 'session.connection.mcp' as const,
      version: sessionConnection.mcpVersion,
      connection_type: sessionConnection.mcpConnectionType,
      client: sessionConnection.clientInfo
        ? {
            object: 'session.connection.client' as const,
            ...sessionConnection.clientInfo,
            capabilities: sessionConnection.clientCapabilities ?? {}
          }
        : null,
      server: sessionConnection.serverInfo
        ? {
            object: 'session.connection.server' as const,
            ...sessionConnection.serverInfo,
            capabilities: sessionConnection.serverCapabilities ?? {}
          }
        : null
    },
    metadata: sessionConnection.metadata,
    session_id: sessionConnection.sessionId,
    session_provider_id: sessionConnection.sessionProviderId,
    started_at: sessionConnection.startedAt,
    ended_at: sessionConnection.endedAt,
    created_at: sessionConnection.createdAt,
    updated_at: sessionConnection.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('session.connection', {
        description: "String representing the object's type"
      }),
      id: v.string({
        name: 'id',
        description: 'Unique session connection identifier',
        examples: ['scn_8hJkLmNpQrStUvWx']
      }),
      status: v.nullable(
        v.string({
          name: 'status',
          description: 'Connection status',
          examples: ['active', 'ended']
        })
      ),
      connection_state: v.nullable(
        v.string({
          name: 'connection_state',
          description: 'Connection state',
          examples: ['connected', 'disconnected']
        })
      ),
      mcp: v.object(
        {
          object: v.literal('session.connection.mcp', {
            description: "String representing the object's type"
          }),
          version: v.nullable(
            v.string({
              name: 'version',
              description: 'MCP protocol version',
              examples: ['2024-11-05']
            })
          ),
          connection_type: v.nullable(
            v.string({
              name: 'connection_type',
              description: 'Connection type',
              examples: ['sse', 'streamable_http', 'websocket']
            })
          ),
          client: v.nullable(
            v.object(
              {
                object: v.literal('session.connection.client', {
                  description: "String representing the object's type"
                }),
                name: v.optional(
                  v.string({
                    name: 'name',
                    description: 'Client name',
                    examples: ['Claude Desktop']
                  })
                ),
                version: v.optional(
                  v.string({
                    name: 'version',
                    description: 'Client version',
                    examples: ['1.2.3']
                  })
                ),
                capabilities: v.record(v.any(), {
                  name: 'capabilities',
                  description: 'Client capabilities'
                })
              },
              { name: 'client', description: 'Client information' }
            )
          ),
          server: v.nullable(
            v.object(
              {
                object: v.literal('session.connection.server', {
                  description: "String representing the object's type"
                }),
                name: v.optional(
                  v.string({
                    name: 'name',
                    description: 'Server name',
                    examples: ['GitHub MCP']
                  })
                ),
                version: v.optional(
                  v.string({
                    name: 'version',
                    description: 'Server version',
                    examples: ['0.1.0']
                  })
                ),
                capabilities: v.record(v.any(), {
                  name: 'capabilities',
                  description: 'Server capabilities'
                })
              },
              { name: 'server', description: 'Server information' }
            )
          )
        },
        { name: 'mcp', description: 'MCP connection details' }
      ),
      metadata: v.nullable(
        v.record(v.any(), {
          name: 'metadata',
          description: 'Custom key-value pairs',
          examples: [{ client_id: 'abc123' }]
        })
      ),
      session_id: v.string({
        name: 'session_id',
        description: 'Parent session ID',
        examples: ['ses_4dEfGhJkLmNpQrSt']
      }),
      session_provider_id: v.nullable(
        v.string({
          name: 'session_provider_id',
          description: 'Session provider ID',
          examples: ['spr_3cDeFgHjKlMnPqRs']
        })
      ),
      started_at: v.nullable(
        v.date({
          name: 'started_at',
          description: 'Timestamp when connection started',
          examples: [new Date('2025-09-15T10:30:00Z')]
        })
      ),
      ended_at: v.nullable(
        v.date({
          name: 'ended_at',
          description: 'Timestamp when connection ended',
          examples: [new Date('2025-09-15T11:30:00Z')]
        })
      ),
      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when created',
        examples: [new Date('2025-09-15T10:30:00Z')]
      }),
      updated_at: v.date({
        name: 'updated_at',
        description: 'Timestamp when last updated',
        examples: [new Date('2026-01-10T14:45:00Z')]
      })
    })
  )
  .build();
