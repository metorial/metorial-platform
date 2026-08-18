import { internalServerError, isServiceError } from '@lowerdeck/error';
import { getSentry } from '@lowerdeck/sentry';
import { serialize } from '@lowerdeck/serialize';
import type { TopicContext } from '@metorial-subspace/conduit';
import {
  TimeoutError,
  withTimeout,
  type BroadcastMessage,
  type ConduitDiagnosticsResult,
  type ConduitHeartbeatPong,
  type ConduitInput,
  type ConduitListToolsResult,
  type ConduitResult
} from '@metorial-subspace/connection-utils';
import { db, ID, type SessionMessage } from '@metorial-subspace/db';
import {
  providerSpecificationInternalService,
  providerVersionSpecificationMergeService
} from '@metorial-subspace/module-provider-internal';
import {
  normalizeProviderError,
  providerErrorToOutput,
  type NormalizedProviderError
} from '@metorial-subspace/provider-utils';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import { isConduitHeartbeatPing } from '../health/conduitHeartbeat';
import { conduit } from '../lib/conduit';
import { broadcastNats } from '../lib/nats';
import { CONDUIT_CONNECTION_MAX_PROCESSING_MS } from '../lib/timeouts';
import { topics } from '../lib/topic';
import { completeMessage } from '../shared/completeMessage';
import { setConnectionProviderSpecification } from '../shared/connectionSpecification';
import { createMessage } from '../shared/createMessage';
import { upsertParticipant } from '../shared/upsertParticipant';
import { ConnectionState } from './state';
import { getConnectionBackendConnection } from './state/backend';

let Sentry = getSentry();

type ConnectionBackendConnection = Awaited<ReturnType<typeof getConnectionBackendConnection>>;

type ProviderBoundInput = Extract<
  ConduitInput,
  { type: 'tool_call' | 'mcp.message_from_client' }
>;

let PENDING_REQUEST_TTL_REFRESH_MS = 10_000;
let PENDING_REQUEST_LOG_THRESHOLDS_MS = [30_000, 60_000, 5 * 60_000];

const NO_OUTPUT_ERROR = {
  type: 'error',
  data: { code: 'no_result', message: 'Provided did not return a result' }
} satisfies PrismaJson.SessionMessageOutput;

class ProviderConnectError extends Error {
  constructor(readonly normalized: NormalizedProviderError) {
    super(normalized.message);
    this.name = 'ProviderConnectError';
  }
}

class ConnectionMessageTimeoutError extends Error {
  constructor(
    public readonly messageId: string,
    public readonly timeoutMs: number
  ) {
    super(`message ${messageId} exceeded receiver timeout (${timeoutMs}ms)`);
    this.name = 'ConnectionMessageTimeoutError';
  }
}

let startPendingRequestActivity = (opts: {
  ctx: TopicContext;
  state: ConnectionState;
  message: SessionMessage;
}) => {
  let stopped = false;
  let startedAt = Date.now();
  let nextLogThresholdIndex = 0;

  let emitTick = async () => {
    if (stopped) return;

    let elapsedMs = Date.now() - startedAt;
    opts.ctx.extendTtl(opts.state.messageTTLExtensionMs);

    while (
      nextLogThresholdIndex < PENDING_REQUEST_LOG_THRESHOLDS_MS.length &&
      elapsedMs >= PENDING_REQUEST_LOG_THRESHOLDS_MS[nextLogThresholdIndex]!
    ) {
      let thresholdMs = PENDING_REQUEST_LOG_THRESHOLDS_MS[nextLogThresholdIndex]!;
      console.warn(
        `CONNECTION.receiver.pending_request receiverId=${connectionReceiver?.getReceiverId() ?? 'unknown'} messageId=${opts.message.id} methodOrToolKey=${opts.message.methodOrToolKey ?? 'unknown'} elapsedMs=${elapsedMs} thresholdMs=${thresholdMs}`
      );
      nextLogThresholdIndex++;
    }
  };

  let ttlInterval = setInterval(() => {
    void emitTick().catch(err => {
      Sentry.captureException(err);
      console.error(`CONNECTION.receiver.ttl_refresh.error messageId=${opts.message.id}`, err);
    });
  }, PENDING_REQUEST_TTL_REFRESH_MS);

  return {
    stop: () => {
      stopped = true;
      clearInterval(ttlInterval);
    }
  };
};

let connectionReceiver:
  | (ReturnType<typeof conduit.createConduitReceiver> & { started: Promise<void> })
  | null = null;
let connectionReceiverHealthInterval: Timer | null = null;
let lastConnectionReceiverHealthState: { ready: boolean; healthy: boolean } | null = null;

export let getConnectionReceiver = () => connectionReceiver;

let stopConnectionReceiverHealthLogging = () => {
  if (connectionReceiverHealthInterval) {
    clearInterval(connectionReceiverHealthInterval);
    connectionReceiverHealthInterval = null;
  }
};

let startConnectionReceiverHealthLogging = (
  receiver: ReturnType<typeof conduit.createConduitReceiver>
) => {
  stopConnectionReceiverHealthLogging();
  lastConnectionReceiverHealthState = null;

  connectionReceiverHealthInterval = setInterval(() => {
    let ready = receiver.isReady();
    let healthy = receiver.isHealthy();
    let previous = lastConnectionReceiverHealthState;
    lastConnectionReceiverHealthState = { ready, healthy };

    if (!previous || (previous.ready === ready && previous.healthy === healthy)) {
      return;
    }

    let stats = receiver.getStats();
    let handledTopics = receiver.getHandledTopics();
    let ownedTopics = receiver.getOwnedTopics();
    let summary =
      `receiverId=${receiver.getReceiverId()} ready=${ready} healthy=${healthy} ` +
      `ownedTopics=${ownedTopics.length} handledTopics=${handledTopics.length} ` +
      `inFlight=${stats.inFlight} processing=${stats.processing} ` +
      `slotsAvail=${stats.handlerSlotsAvailable} waiting=${stats.handlerWaiting} ` +
      `dispatched=${stats.dispatched} shed=${stats.shed} ` +
      `ceilingAborts=${stats.ceilingAborts} dedupHits=${stats.dedupHits} ` +
      `orphaned=${stats.orphaned} orphanedTotal=${stats.orphanedTotal} ` +
      `sinceProgressMs=${Date.now() - stats.lastProgressAt}`;

    if (previous.healthy && !healthy) {
      console.error(
        `CONNECTION.receiver.unhealthy ${summary} ownedTopicList=${JSON.stringify(ownedTopics)} handledTopicList=${JSON.stringify(handledTopics)}`
      );
      return;
    }

    if (!previous.healthy && healthy) {
      console.warn(`CONNECTION.receiver.recovered ${summary}`);
    }
  }, 1000);
};

export let startReceiver = () => {
  let receiver = conduit.createConduitReceiver(
    async ctx => {
      ctx.extendTtl(1000 * 60);

      if (topics.workerHeartbeat.is(ctx.topic)) {
        ctx.extendTtl(5000);
        ctx.onMessage(async data => {
          if (!isConduitHeartbeatPing(data)) {
            throw new Error('Invalid conduit heartbeat ping');
          }

          return {
            type: 'health.pong',
            id: data.id,
            sentAt: data.sentAt,
            receivedAt: Date.now()
          } satisfies ConduitHeartbeatPong;
        });
        return;
      }

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

      let clientMcpIdTranslation = new Map<string, string | number>();

      let onBackendClose = async () => {
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
      };

      let onProviderMcpNotificationOrRequest = async (mcpMessage: JSONRPCMessage) => {
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
      };

      // Established lazily so that the receiver can acknowledge messages and start
      // extending the sender's deadline before a slow provider finishes connecting.
      let backendPromise: Promise<ConnectionBackendConnection> | null = null;
      let getBackend = () => {
        if (!backendPromise) {
          backendPromise = (async () => {
            let backend = await getConnectionBackendConnection(state);

            backend.onMcpNotificationOrRequest(onProviderMcpNotificationOrRequest);
            backend.onClose(onBackendClose);

            return backend;
          })();

          backendPromise.catch(() => {});
        }

        return backendPromise;
      };

      let connectBackend = async () => {
        try {
          return await withTimeout(
            getBackend(),
            state.timeouts.connectTimeoutMs,
            'Provider connection'
          );
        } catch (error) {
          throw new ProviderConnectError(
            error instanceof TimeoutError
              ? normalizeProviderError({ code: 'provider_connect_timeout' })
              : normalizeProviderError(error, 'provider_unreachable')
          );
        }
      };

      let sendToProviderInnerToolCall = async (
        data: ConduitInput & { type: 'tool_call' },
        message: SessionMessage
      ) => {
        let [backend, tool] = await Promise.all([
          connectBackend(),
          db.providerTool.findFirstOrThrow({
            where: { id: data.toolId, adapterOid: null }
          })
        ]);

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

        let backend = await connectBackend();

        return await backend.sendMcpResponseOrNotification({
          sender: state.participant,
          input: mcpMessage,
          message
        });
      };

      let sendToProviderInner = async (data: ProviderBoundInput, message: SessionMessage) => {
        if (data.type === 'tool_call') {
          return await sendToProviderInnerToolCall(data, message);
        }

        return await sendToProviderInnerMcpMessage(data, message);
      };

      let sendToProvider = async (data: ProviderBoundInput) => {
        let message = await db.sessionMessage.findFirstOrThrow({
          where: { id: data.sessionMessageId }
        });
        let pendingRequest = startPendingRequestActivity({ ctx, state, message });
        let providerPromise = sendToProviderInner(data, message);
        let timedOut = false;
        let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

        try {
          providerPromise.catch(err => {
            if (!timedOut) return;
            Sentry.captureException(err);
            console.warn(
              `CONNECTION.receiver.provider_after_timeout messageId=${message.id} methodOrToolKey=${message.methodOrToolKey ?? 'unknown'} timeoutMs=${state.messageProcessingTimeoutMs}:`,
              err
            );
          });

          let timeoutPromise = new Promise<never>((_, reject) => {
            timeoutHandle = setTimeout(() => {
              timedOut = true;
              reject(
                new ConnectionMessageTimeoutError(message.id, state.messageProcessingTimeoutMs)
              );
            }, state.messageProcessingTimeoutMs);
          });

          let result = await Promise.race([providerPromise, timeoutPromise]);

          if (!result.output) {
            return {
              isSystemError: false,
              status: 'succeeded' as const,
              output: null,
              completedAt: new Date(),
              slateToolCall: result.slateToolCall,
              failureReason: undefined,
              closeContext: false
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
            slateToolCall: result.slateToolCall,
            failureReason: undefined,
            closeContext: false
          };
        } catch (err) {
          if (err instanceof ProviderConnectError) {
            console.warn(
              `CONNECTION.receiver.provider_connect_failed messageId=${message.id} code=${err.normalized.code}`
            );

            return {
              isSystemError: false,
              output: {
                type: 'error',
                data: providerErrorToOutput(err.normalized).error
              } satisfies PrismaJson.SessionMessageOutput,
              status: 'failed' as const,
              completedAt: new Date(),
              slateToolCall: undefined,
              failureReason: undefined,
              closeContext: false
            };
          }

          if (err instanceof ConnectionMessageTimeoutError) {
            Sentry.captureException(err);
            console.error(
              `CONNECTION.receiver.message_timeout messageId=${message.id} methodOrToolKey=${message.methodOrToolKey ?? 'unknown'} timeoutMs=${err.timeoutMs}`
            );

            return {
              isSystemError: false,
              output: {
                type: 'error',
                data: {
                  code: 'timeout',
                  message: `The request exceeded the configured tenant timeout of ${err.timeoutMs}ms.`
                }
              } satisfies PrismaJson.SessionMessageOutput,
              status: 'failed' as const,
              completedAt: new Date(),
              slateToolCall: undefined,
              failureReason: 'timeout' as const,
              closeContext: true
            };
          }

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
            slateToolCall: undefined,
            failureReason: 'system_error' as const,
            closeContext: false
          };
        } finally {
          if (timeoutHandle) {
            clearTimeout(timeoutHandle);
          }
          pendingRequest.stop();
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
            failureReason:
              res.failureReason ?? (res.isSystemError ? 'system_error' : undefined)
          }
        );

        let result = {
          message,
          output: message.output ?? res.output ?? NO_OUTPUT_ERROR,
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

        if (res.closeContext) {
          setTimeout(() => {
            void ctx.close().catch(err => {
              console.error('Error closing timed out receiver context:', err);
              Sentry.captureException(err);
            });
          }, 0);
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
            output:
              res.output ??
              ({
                type: 'mcp',
                data: data.mcpMessage
              } satisfies PrismaJson.SessionMessageOutput),
            status: res.status,
            providerRun: state.providerRun,
            completedAt: res.completedAt,
            slateToolCall: res.slateToolCall,
            responderParticipant: state.participant,
            failureReason:
              res.failureReason ?? (res.isSystemError ? 'system_error' : undefined)
          }
        );

        if (res.closeContext) {
          setTimeout(() => {
            void ctx.close().catch(err => {
              console.error('Error closing timed out receiver context:', err);
              Sentry.captureException(err);
            });
          }, 0);
        }
      };

      let processListTools = async (): Promise<ConduitListToolsResult> => {
        let persistFailure = async (error: NormalizedProviderError) => {
          await setConnectionProviderSpecification({
            connectionOid: state.connection.oid,
            sessionProviderOid: state.sessionProvider.oid,
            providerVersionOid: state.version.oid,
            specificationOid: null,
            error: { code: error.code, message: error.message }
          });

          return { status: 'failure' as const, error: { ...error } };
        };

        try {
          let backend = await connectBackend();
          let res = await backend.listConnectionTools();

          if (res.status === 'not_supported') return { status: 'not_supported' };
          if (res.status === 'failure') return await persistFailure(res.error);

          let spec = await providerSpecificationInternalService.ensureProviderSpecification({
            provider: state.version.provider,
            providerVersion: state.version,

            type: res.type,

            specification: res.specification,
            authMethods: res.authMethods,
            features: res.features,
            tools: res.tools,
            triggers: res.triggers
          });

          if (
            state.connectionSpecificationBehavior.mergeDiscoveredToolsIntoVersionSpecification
          ) {
            try {
              await providerVersionSpecificationMergeService.mergeIntoProviderVersionSpecification(
                {
                  provider: state.version.provider,
                  providerVersion: state.version,
                  discovered: {
                    specification: res.specification,
                    authMethods: res.authMethods,
                    features: res.features,
                    tools: res.tools,
                    triggers: res.triggers
                  }
                }
              );
            } catch (err) {
              Sentry.captureException(err);
              console.error('Error merging discovered tools into version specification:', err);
            }
          }

          await setConnectionProviderSpecification({
            connectionOid: state.connection.oid,
            sessionProviderOid: state.sessionProvider.oid,
            providerVersionOid: state.version.oid,
            specificationOid: spec.oid,
            error: null
          });

          return { status: 'success', specificationId: spec.id };
        } catch (err) {
          if (err instanceof ProviderConnectError) return await persistFailure(err.normalized);

          Sentry.captureException(err);
          console.error('Error listing connection tools:', err);

          return await persistFailure(normalizeProviderError(err));
        }
      };

      let processDiagnostics = async (): Promise<ConduitDiagnosticsResult> => {
        if (!backendPromise) return { status: 'not_connected' };

        try {
          let backend = await withTimeout(
            backendPromise,
            state.timeouts.connectTimeoutMs,
            'Provider connection'
          );

          return { status: 'ok', diagnostics: await backend.getConnectionDiagnostics() };
        } catch (error) {
          let normalized =
            error instanceof TimeoutError
              ? normalizeProviderError({ code: 'provider_connect_timeout' })
              : normalizeProviderError(error, 'provider_unreachable');

          return {
            status: 'ok',
            diagnostics: {
              state: 'failed',
              transport: null,
              protocolVersion: null,
              serverInfo: null,
              lastError: { ...normalized }
            }
          };
        }
      };

      ctx.onMessage(async (data: ConduitInput) => {
        ctx.extendTtl(state.messageTTLExtensionMs);

        if (data.type === 'tool_call') return processToolCall(data);
        if (data.type === 'mcp.message_from_client') return processMcpResponse(data);
        if (data.type === 'provider.list_tools') return processListTools();
        if (data.type === 'provider.diagnostics') return processDiagnostics();
      });

      ctx.onClose(async () => {
        try {
          await state.dispose();
        } catch (err) {
          console.error('Error disposing connection state:', err);
          Sentry.captureException(err);
        }

        if (!backendPromise) return;

        try {
          await (await backendPromise).close();
        } catch (err) {
          console.error('Error closing connection backend:', err);
          Sentry.captureException(err);
        }
      });
    },
    {
      timeoutExtensionThreshold: 5_000,
      timeoutExtensionMs: 15_000,
      maxProcessingMs: CONDUIT_CONNECTION_MAX_PROCESSING_MS
    }
  );

  let started = receiver.start();
  started.catch(err => {
    console.error('Error starting Connection Controller receiver:', err);
  });
  started.then(() => {
    startConnectionReceiverHealthLogging(receiver);
  });

  connectionReceiver = Object.assign(receiver, { started });
  return connectionReceiver;
};
