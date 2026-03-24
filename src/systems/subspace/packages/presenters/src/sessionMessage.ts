import { getOffloadedSessionMessage } from '@metorial-subspace/connection-utils';
import {
  messageTranslator,
  type Provider,
  type ProviderRun,
  type ProviderSpecification,
  type ProviderTool,
  type Session,
  type SessionConnection,
  type SessionMessage,
  type SessionParticipant,
  type SessionProvider,
  type ToolCall
} from '@metorial-subspace/db';
import { sessionErrorPresenter, type SessionErrorPresenterProps } from './sessionError';
import { sessionParticipantPresenter } from './sessionParticipant';
import { toolCallPresenter } from './toolCall';

export type SessionMessagePresenterProps = SessionMessage & {
  session: Session;
  sessionProvider: SessionProvider | null;
  senderParticipant: SessionParticipant & { provider: Provider | null };
  responderParticipant: (SessionParticipant & { provider: Provider | null }) | null;
  connection: SessionConnection | null;
  providerRun: ProviderRun | null;
  toolCall:
    | (ToolCall & {
        tool: ProviderTool & {
          provider: Provider;
          specification: Omit<ProviderSpecification, 'value'>;
        };
      })
    | null;
  error: SessionErrorPresenterProps | null;
  parentMessage: SessionMessage | null;
  childMessages: SessionMessage[];
};

export let sessionMessagePresenter = async (message: SessionMessagePresenterProps) => {
  if (message.isOffloadedToStorage) {
    let offloaded = await getOffloadedSessionMessage(message);
    if (offloaded) {
      message.input = offloaded.input;
      message.output = offloaded.output;
    }
  }

  return {
    object: 'session.message',

    id: message.id,
    type: message.type,
    status: message.status,
    source: message.source,

    sessionId: message.session.id,
    sessionProviderId: message.sessionProvider?.id || null,
    connectionId: message.connection?.id || null,
    providerRunId: message.providerRun?.id || null,

    hierarchy: {
      type: message.parentMessage ? 'child' : 'parent',
      parentMessageId: message.parentMessage?.id,
      childMessageIds: message.childMessages.map(child => child.id)
    },

    transport: {
      object: 'session.message.transport',

      type: message.transport,

      mcp:
        message.transport === 'mcp'
          ? {
              object: 'session.message.transport#mcp',

              id: message.input?.data?.id ?? message.clientMcpId ?? message.id,
              protocolVersion: message.connection?.mcpProtocolVersion ?? 'unknown',

              transport: {
                none: 'unknown',
                sse: 'sse',
                streamable_http: 'streamable_http'
              }[message.connection?.mcpTransport ?? 'none']
            }
          : undefined,

      toolCall:
        message.transport !== 'tool_call'
          ? {
              object: 'session.message.transport#tool_call',
              id: message.toolCall?.id || null
            }
          : undefined
    },

    input: message.input
      ? await messageTranslator.inputToMcpBasic(message.input, message)
      : null,
    output: message.output
      ? await messageTranslator.outputToMcpBasic(message.output, message)
      : null,

    toolCall: message.toolCall
      ? await toolCallPresenter({
          ...message.toolCall,
          message
        })
      : null,

    senderParticipant: await sessionParticipantPresenter(message.senderParticipant),
    responderParticipant: message.responderParticipant
      ? await sessionParticipantPresenter(message.responderParticipant)
      : null,

    error: message.error ? await sessionErrorPresenter(message.error) : null,

    createdAt: message.createdAt
  };
};
