import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { sessionConnectionType } from '../../../types';
import { v1SessionParticipantPresenter } from './sessionParticipant';

export let v1SessionConnectionPresenter = Presenter.create(sessionConnectionType)
  .presenter(async ({ sessionConnection }, opts) => ({
    object: 'session.connection' as const,

    id: sessionConnection.id,
    connection_state: sessionConnection.state,
    transport: sessionConnection.transport,

    usage: {
      total_productive_client_message_count:
        sessionConnection.totalProductiveClientMessageCount,
      total_productive_provider_message_count:
        sessionConnection.totalProductiveProviderMessageCount
    },

    mcp:
      sessionConnection.mcpData.capabilities && sessionConnection.mcpData.protocolVersion
        ? {
            capabilities: sessionConnection.mcpData.capabilities,
            protocol_version: sessionConnection.mcpData.protocolVersion,
            transport: sessionConnection.mcpTransport
          }
        : null,

    session_id: sessionConnection.session.id,

    participant: sessionConnection.participant
      ? await v1SessionParticipantPresenter
          .present({ sessionParticipant: sessionConnection.participant }, opts)
          .run()
      : null,

    has_errors: sessionConnection.hasErrors,
    has_warnings: sessionConnection.hasWarnings,

    created_at: sessionConnection.createdAt,
    last_message_at: sessionConnection.lastMessageAt,
    last_active_at: sessionConnection.lastActiveAt
  }))
  .schema(
    v.object({
      object: v.literal('session.connection', {
        description: "String representing the object’s type."
      }),
      id: v.string({
        name: 'id',
        description: 'Unique ID.',
        examples: ['scn_8hJkLmNpQrStUvWx']
      }),
      connection_state: v.enumOf(['connected', 'disconnected'], {
        name: 'connection_state',
        description: 'Whether the connection is currently open.'
      }),
      transport: v.enumOf(['mcp', 'tool_call', 'metorial_protocol', 'system'] as const, {
        name: 'transport',
        description: 'Transport protocol used'
      }),
      usage: v.object(
        {
          total_productive_client_message_count: v.number({
            name: 'total_productive_client_message_count',
            description: 'Total productive client messages'
          }),
          total_productive_provider_message_count: v.number({
            name: 'total_productive_provider_message_count',
            description: 'Total productive provider messages'
          })
        },
        { name: 'usage', description: 'Usage statistics' }
      ),
      mcp: v.nullable(
        v.object(
          {
            capabilities: v.record(v.any(), {
              name: 'capabilities',
              description: 'Capabilities the client reported.'
            }),
            protocol_version: v.string({
              name: 'protocol_version',
              description: 'Negotiated MCP version.',
              examples: ['2024-11-05']
            }),
            transport: v.enumOf(['none', 'sse', 'streamable_http', 'sessionless'] as const, {
              name: 'transport',
              description: 'How the MCP connection is carried.'
            })
          },
          { name: 'mcp', description: 'MCP connection details' }
        )
      ),
      session_id: v.string({
        name: 'session_id',
        description: 'Session this connection belongs to.',
        examples: ['ses_4dEfGhJkLmNpQrSt']
      }),
      participant: v.nullable(v1SessionParticipantPresenter.schema),
      has_errors: v.boolean({
        name: 'has_errors',
        description: '`true` when the connection has errors.'
      }),
      has_warnings: v.boolean({
        name: 'has_warnings',
        description: '`true` when the connection has warnings.'
      }),
      created_at: v.date({
        name: 'created_at',
        description: 'Creation time.',
        examples: [new Date('2025-09-15T10:30:00Z')]
      }),
      last_message_at: v.date({
        name: 'last_message_at',
        description: 'When the connection last exchanged a message.',
        examples: [new Date('2025-09-15T10:30:00Z')]
      }),
      last_active_at: v.nullable(
        v.date({
          name: 'last_active_at',
          description: 'Last time the connection showed activity.',
          examples: [new Date('2025-09-15T10:30:00Z')]
        })
      )
    })
  )
  .build();
