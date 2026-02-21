import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { sessionConnectionType } from '../../types';
import { v1SessionParticipantPresenter } from './sessionParticipant';

export let v1SessionConnectionPresenter = Presenter.create(sessionConnectionType)
  .presenter(async ({ sessionConnection }, opts) => ({
    object: 'session.connection' as const,

    id: sessionConnection.id,
    status: sessionConnection.status,
    connection_state: sessionConnection.connectionState,
    transport: sessionConnection.transport,

    usage: {
      total_productive_client_message_count:
        sessionConnection.usage.totalProductiveClientMessageCount,
      total_productive_server_message_count:
        sessionConnection.usage.totalProductiveServerMessageCount
    },

    mcp: sessionConnection.mcp
      ? {
          capabilities: sessionConnection.mcp.capabilities,
          protocol_version: sessionConnection.mcp.protocolVersion,
          transport: sessionConnection.mcp.transport
        }
      : null,

    session_id: sessionConnection.sessionId,

    participant: sessionConnection.participant
      ? await v1SessionParticipantPresenter
          .present({ sessionParticipant: sessionConnection.participant }, opts)
          .run()
      : null,

    created_at: sessionConnection.createdAt,
    last_message_at: sessionConnection.lastMessageAt,
    last_active_at: sessionConnection.lastActiveAt
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
      status: v.string({
        name: 'status',
        description: 'Connection status',
        examples: ['active', 'archived']
      }),
      connection_state: v.string({
        name: 'connection_state',
        description: 'Connection state',
        examples: ['connected', 'disconnected']
      }),
      transport: v.string({
        name: 'transport',
        description: 'Transport protocol used',
        examples: ['mcp', 'tool_call', 'metorial_protocol', 'system']
      }),
      usage: v.object(
        {
          total_productive_client_message_count: v.number({
            name: 'total_productive_client_message_count',
            description: 'Total productive client messages'
          }),
          total_productive_server_message_count: v.number({
            name: 'total_productive_server_message_count',
            description: 'Total productive server messages'
          })
        },
        { name: 'usage', description: 'Usage statistics' }
      ),
      mcp: v.nullable(
        v.object(
          {
            capabilities: v.record(v.any(), {
              name: 'capabilities',
              description: 'MCP capabilities'
            }),
            protocol_version: v.string({
              name: 'protocol_version',
              description: 'MCP protocol version',
              examples: ['2024-11-05']
            }),
            transport: v.string({
              name: 'transport',
              description: 'MCP transport type',
              examples: ['sse', 'streamable_http']
            })
          },
          { name: 'mcp', description: 'MCP connection details' }
        )
      ),
      session_id: v.string({
        name: 'session_id',
        description: 'Parent session ID',
        examples: ['ses_4dEfGhJkLmNpQrSt']
      }),
      participant: v.nullable(v1SessionParticipantPresenter.schema),
      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when created',
        examples: [new Date('2025-09-15T10:30:00Z')]
      }),
      last_message_at: v.date({
        name: 'last_message_at',
        description: 'Timestamp of last message',
        examples: [new Date('2025-09-15T10:30:00Z')]
      }),
      last_active_at: v.date({
        name: 'last_active_at',
        description: 'Timestamp when last active',
        examples: [new Date('2025-09-15T10:30:00Z')]
      })
    })
  )
  .build();
