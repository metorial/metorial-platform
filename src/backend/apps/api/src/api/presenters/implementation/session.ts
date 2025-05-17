import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { sessionType } from '../types';

export let v1SessionPresenter = Presenter.create(sessionType)
  .presenter(async ({ session }, opts) => {
    let totalProductiveClientMessageCount = session.serverSessions.reduce(
      (acc, serverSession) => acc + serverSession.totalProductiveClientMessageCount,
      0
    );

    let totalProductiveServerMessageCount = session.serverSessions.reduce(
      (acc, serverSession) => acc + serverSession.totalProductiveServerMessageCount,
      0
    );

    return {
      object: 'session',

      id: session.id,

      status: session.status,
      connection_status: session.connectionStatus,

      client_secret: {
        object: 'client_secret',

        id: session.clientSecretId,
        secret: session.clientSecretValue,
        expires_at: session.clientSecretExpiresAt
      },

      server_deployments: session.serverDeployments.map(serverDeployment => ({
        object: 'server.server_deployment#preview',

        id: serverDeployment.id,
        status: serverDeployment.status,

        name: serverDeployment.name,
        description: serverDeployment.description,

        metadata: serverDeployment.metadata,

        server: {
          object: 'server#preview',

          id: serverDeployment.server.id,
          name: serverDeployment.server.name,
          description: serverDeployment.server.description,

          type: { imported: 'public' as const }[serverDeployment.server.type],

          created_at: serverDeployment.server.createdAt,
          updated_at: serverDeployment.server.updatedAt
        },

        created_at: serverDeployment.createdAt,
        updated_at: serverDeployment.updatedAt
      })),

      server_sessions: session.serverSessions.map(serverSession => ({
        object: 'session.server_session',

        id: serverSession.id,
        status: 'active',

        mcp: {
          object: 'mcp',

          version: serverSession.mcpVersion,
          connection_type: serverSession.mcpConnectionType,

          client: serverSession.clientInfo
            ? {
                object: 'session.server_session.client',
                name: serverSession.clientInfo.name,
                version: serverSession.clientInfo.version,

                capabilities: serverSession.clientCapabilities ?? {}
              }
            : null,

          server: serverSession.serverInfo
            ? {
                object: 'session.server_session.server',

                name: serverSession.serverInfo.name,
                version: serverSession.serverInfo.version,

                capabilities: serverSession.serverCapabilities ?? {}
              }
            : null
        },

        usage: {
          total_productive_message_count:
            serverSession.totalProductiveClientMessageCount +
            serverSession.totalProductiveServerMessageCount,
          total_productive_client_message_count:
            serverSession.totalProductiveClientMessageCount,
          total_productive_server_message_count:
            serverSession.totalProductiveServerMessageCount
        },

        server_deployment_id: serverSession.serverDeployment.id,
        session_id: session.id,

        created_at: serverSession.createdAt
      })),

      usage: {
        total_productive_message_count:
          totalProductiveClientMessageCount + totalProductiveServerMessageCount,
        total_productive_client_message_count: totalProductiveClientMessageCount,
        total_productive_server_message_count: totalProductiveServerMessageCount
      },

      metadata: session.metadata,

      created_at: session.createdAt,
      updated_at: session.updatedAt
    };
  })
  .schema(
    v.object({
      object: v.literal('session'),

      id: v.string(),
      status: v.enumOf(['active', 'deleted']),
      connection_status: v.enumOf(['connected', 'disconnected']),

      client_secret: v.object({
        object: v.literal('client_secret'),

        id: v.string(),
        secret: v.string(),
        expires_at: v.date()
      }),

      server_deployments: v.array(
        v.object({
          object: v.literal('server.server_deployment#preview'),

          id: v.string(),
          status: v.enumOf(['active', 'archived', 'deleted']),

          name: v.string(),
          description: v.nullable(v.string()),
          metadata: v.record(v.any()),

          secret_id: v.string(),

          server: v.object({
            object: v.literal('server#preview'),

            id: v.string(),
            name: v.string(),
            description: v.nullable(v.string()),
            type: v.enumOf(['public']),

            created_at: v.date(),
            updated_at: v.date()
          }),

          created_at: v.date(),
          updated_at: v.date()
        })
      ),

      server_sessions: v.array(
        v.object({
          object: v.literal('session.server_session'),

          id: v.string(),
          status: v.enumOf(['active']),

          mcp: v.object({
            object: v.literal('mcp'),

            version: v.string(),
            connection_type: v.enumOf(['sse', 'streamable_http', 'websocket']),

            client: v.nullable(
              v.object({
                object: v.literal('session.server_session.client'),
                name: v.string(),
                version: v.string(),

                capabilities: v.record(v.any())
              })
            ),

            server: v.nullable(
              v.object({
                object: v.literal('session.server_session.server'),

                name: v.string(),
                version: v.string(),

                capabilities: v.record(v.any())
              })
            )
          }),

          usage: v.object({
            total_productive_message_count: v.number(),
            total_productive_client_message_count: v.number(),
            total_productive_server_message_count: v.number()
          }),

          server_deployment_id: v.string(),
          session_id: v.string(),

          created_at: v.date()
        })
      ),

      usage: v.object({
        total_productive_message_count: v.number(),
        total_productive_client_message_count: v.number(),
        total_productive_server_message_count: v.number()
      }),

      metadata: v.record(v.any()),

      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();
