import type {
  Provider,
  Session,
  SessionConnection,
  SessionParticipant
} from '@metorial-subspace/db';
import { sessionParticipantPresenter } from './sessionParticipant';

export type SessionConnectionPresenterProps = SessionConnection & {
  session: Session;
  participant:
    | (SessionParticipant & {
        provider: Provider | null;
      })
    | null;
};

export let sessionConnectionPresenter = (connection: SessionConnectionPresenterProps) => ({
  object: 'session.connection',

  id: connection.id,
  status: connection.status,
  connectionState: connection.state,
  transport: connection.transport,

  hasErrors: connection.hasErrors,
  hasWarnings: connection.hasWarnings,

  usage: {
    totalProductiveClientMessageCount: connection.totalProductiveClientMessageCount,
    totalProductiveProviderMessageCount: connection.totalProductiveProviderMessageCount
  },

  mcp:
    connection.mcpData.capabilities && connection.mcpData.protocolVersion
      ? {
          capabilities: connection.mcpData.capabilities,
          protocolVersion: connection.mcpData.protocolVersion,
          transport: connection.mcpTransport
        }
      : null,

  sessionId: connection.session.id,

  participant: connection.participant
    ? sessionParticipantPresenter(connection.participant)
    : null,

  createdAt: connection.createdAt,
  lastMessageAt: connection.lastMessageAt,
  lastActiveAt: connection.lastActiveAt
});
