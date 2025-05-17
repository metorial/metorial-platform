import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { sessionType } from '../types';
import { v1ServerDeploymentPreviewPresenter } from './serverDeployment';
import { v1ServerSessionPresenter } from './serverSession';

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

        type: 'session' as const,
        id: session.clientSecretId,
        secret: session.clientSecretValue,
        expires_at: session.clientSecretExpiresAt
      },

      server_deployments: await Promise.all(
        session.serverDeployments.map(serverDeployment =>
          v1ServerDeploymentPreviewPresenter
            .present(
              {
                serverDeployment
              },
              opts
            )
            .run()
        )
      ),

      server_sessions: await Promise.all(
        session.serverSessions.map(serverSession =>
          v1ServerSessionPresenter
            .present(
              {
                serverSession,
                session
              },
              opts
            )
            .run()
        )
      ),

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

        type: v.enumOf(['session']),
        id: v.string(),
        secret: v.string(),
        expires_at: v.date()
      }),

      server_deployments: v.array(v1ServerDeploymentPreviewPresenter.schema),

      server_sessions: v.array(v1ServerSessionPresenter.schema),

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
