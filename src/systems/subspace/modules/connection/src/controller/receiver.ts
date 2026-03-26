import { internalServerError, isServiceError } from '@lowerdeck/error';
import { getSentry } from '@lowerdeck/sentry';
import { serialize } from '@lowerdeck/serialize';
import type {
  BroadcastMessage,
  ConduitInput,
  ConduitResult
} from '@metorial-subspace/connection-utils';
import { db, ID, type SessionMessage } from '@metorial-subspace/db';
import { conduit } from '../lib/conduit';
import { broadcastNats } from '../lib/nats';
import { topics } from '../lib/topic';
import { completeMessage } from '../shared/completeMessage';
import { createMessage } from '../shared/createMessage';
import { upsertParticipant } from '../shared/upsertParticipant';
import { ConnectionState } from './state';
import { getConnectionBackendConnection } from './state/backend';

let Sentry = getSentry();

const NO_OUTPUT_ERROR = {
  type: 'error',
  data: { code: 'no_result', message: 'Provided did not return a result' }
} satisfies PrismaJson.SessionMessageOutput;

export let startReceiver = () => {
  let receiver = conduit.createConduitReceiver(async ctx => {
    ctx.extendTtl(1000 * 60);

    let topic = topics.instance.decode(ctx.topic);
    if (!topic) {
      console.warn(`Received message on invalid topic: ${ctx.topic}`);
      ctx.close();
      return;
    }

    let state = await ConnectionState.create(topic, () => {
      ctx.close();
    });
    if (!state) {
      ctx.close();
      return;
    }

    let providerParticipant = await upsertParticipant({
      session: state.session,
      from: {
        type: 'provider',
        provider: state.provider
      }
    });

    let backend = await getConnectionBackendConnection(state);

    let clientMcpIdTranslation = new Map<string, string | number>();

    backend.onMcpNotificationOrRequest(async mcpMessage => {
      let id = 'id' in mcpMessage ? mcpMessage.id : undefined;
      let method = 'method' in mcpMessage ? mcpMessage.method : undefined;

      let providerMcpId: string | undefined;
      if (id !== undefined && id !== null) {
        providerMcpId = await ID.generateId('sessionMessage_mcp');
        clientMcpIdTranslation.set(providerMcpId, id);

        // @ts-ignore
        mcpMessage.id = providerMcpId;
      }

      let message = await createMessage({
        status: id !== undefined && id !== null ? 'waiting_for_response' : 'succeeded',
        type: 'mcp_message',
        session: state.session,
        connection: state.connection,
        source: 'provider',
        provider: state.sessionProvider,
        senderParticipant: providerParticipant,
        transport: 'mcp',
        input: { type: 'mcp', data: mcpMessage },
        isProductive: true,
        methodOrToolKey: method,
        providerMcpId
      });

      await broadcastNats.publish(
        topics.sessionConnection.encode({
          session: state.session,
          connection: state.connection
        }),
        serialize.encode({
          type: 'message_processed',
          sessionId: state.session.id,
          result: {
            message,
            output: { type: 'mcp', data: mcpMessage },
            status: 'succeeded',
            completedAt: new Date()
          } satisfies ConduitResult,
          channel: 'broadcast_response_or_notification'
        } satisfies BroadcastMessage)
      );
    });

    let sendToProviderInnerToolCall = async (
      data: ConduitInput & { type: 'tool_call' },
      message: SessionMessage
    ) => {
      let tool = await db.providerTool.findFirstOrThrow({
        where: { id: data.toolId }
      });

      return await backend.sendToolInvocation({
        tool,
        message,
        input: data.input,
        sender: state.participant,
        sessionProvider: state.sessionProvider
      });
    };

    let sendToProviderInnerMcpMessage = async (
      data: ConduitInput & { type: 'mcp.message_from_client' },
      message: SessionMessage
    ) => {
      let mcpMessage = data.mcpMessage;

      let id: any = 'id' in mcpMessage ? mcpMessage.id : undefined;
      if (id !== undefined && id !== null) {
        // We can only process a reply from the client if we
        // have seen the original message and have a mapping for the ID
        if (!clientMcpIdTranslation.has(id)) return {};

        // @ts-ignore
        mcpMessage.id = clientMcpIdTranslation.get(id);
      }

      return await backend.sendMcpResponseOrNotification({
        sender: state.participant,
        input: mcpMessage,
        message
      });
    };

    let sendToProviderInner = async (data: ConduitInput, message: SessionMessage) => {
      if (data.type === 'tool_call') {
        return await sendToProviderInnerToolCall(data, message);
      } else if (data.type === 'mcp.message_from_client') {
        return await sendToProviderInnerMcpMessage(data, message);
      }

      throw new Error(`Unsupported ConduitInput`);
    };

    let sendToProvider = async (data: ConduitInput) => {
      let message = await db.sessionMessage.findFirstOrThrow({
        where: { id: data.sessionMessageId }
      });

      try {
        let result = await sendToProviderInner(data, message);

        if (!result.output) {
          return {
            isSystemError: false,
            status: 'succeeded' as const,
            output: null,
            completedAt: new Date(),
            slateToolCall: result.slateToolCall
          };
        }

        let status =
          result.output.type === 'success' ? ('succeeded' as const) : ('failed' as const);
        let output =
          result.output.type === 'error'
            ? { type: 'error' as const, data: result.output.error }
            : result.output.data;

        if (output.type === 'mcp' && 'error' in output.data && output.data.error) {
          status = 'failed';
        }

        return {
          isSystemError: false,
          status,
          output,
          completedAt: new Date(),
          slateToolCall: result.slateToolCall
        };
      } catch (err) {
        Sentry.captureException(err);

        console.error('Error processing tool invocation:', err);

        let error = isServiceError(err)
          ? err.toResponse()
          : internalServerError({
              message: 'Failed to process tool call'
            }).toResponse();

        return {
          isSystemError: true,
          output: { type: 'error', data: error } satisfies PrismaJson.SessionMessageOutput,
          status: 'failed' as const,
          completedAt: new Date(),
          slateToolCall: undefined
        };
      }
    };

    let processToolCall = async (data: ConduitInput & { type: 'tool_call' }) => {
      let res = await sendToProvider(data);

      let message = await completeMessage(
        { messageId: data.sessionMessageId },
        {
          output: res.output ?? NO_OUTPUT_ERROR,
          status: res.status,
          providerRun: state.providerRun,
          completedAt: res.completedAt,
          slateToolCall: res.slateToolCall,
          responderParticipant: providerParticipant,
          failureReason: res.isSystemError ? 'system_error' : undefined
        }
      );

      let result = {
        message,
        output: res.output ?? NO_OUTPUT_ERROR,
        status: res.status,
        completedAt: res.completedAt
      } satisfies ConduitResult;

      if (result.output) {
        await broadcastNats.publish(
          topics.sessionConnection.encode({
            session: state.session,
            connection: state.connection
          }),
          serialize.encode({
            type: 'message_processed',
            sessionId: state.session.id,
            channel: 'targeted_response',
            result
          } satisfies BroadcastMessage)
        );
      }

      return result;
    };

    let processMcpResponse = async (
      data: ConduitInput & { type: 'mcp.message_from_client' }
    ) => {
      let res = await sendToProvider(data);

      await completeMessage(
        { messageId: data.sessionMessageId },
        {
          output: { type: 'mcp', data: data.mcpMessage },
          status: res.status,
          providerRun: state.providerRun,
          completedAt: res.completedAt,
          slateToolCall: res.slateToolCall,
          responderParticipant: state.participant,
          failureReason: res.isSystemError ? 'system_error' : undefined
        }
      );
    };

    ctx.onMessage(async (data: ConduitInput) => {
      ctx.extendTtl(state.messageTTLExtensionMs);

      if (data.type === 'tool_call') return processToolCall(data);
      if (data.type === 'mcp.message_from_client') return processMcpResponse(data);
    });

    backend.onClose(async () => {
      try {
        await ctx.close();
      } catch (err) {
        console.error('Error closing context on backend close:', err);
        Sentry.captureException(err);
      }

      try {
        await state.dispose();
      } catch (err) {
        console.error('Error disposing connection state:', err);
        Sentry.captureException(err);
      }
    });

    ctx.onClose(async () => {
      try {
        await state.dispose();
      } catch (err) {
        console.error('Error disposing connection state:', err);
        Sentry.captureException(err);
      }
      try {
        await backend.close();
      } catch (err) {
        console.error('Error closing connection backend:', err);
        Sentry.captureException(err);
      }
    });
  });

  let started = receiver.start();
  started.catch(err => {
    console.error('Error starting Connection Controller receiver:', err);
  });

  return Object.assign(receiver, { started });
};
