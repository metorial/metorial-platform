import { db } from '@metorial-subspace/db';
import {
  createProviderInvocationId,
  IProviderInvocation,
  parseStoredProviderInvocationId,
  type ProviderInvocationGetParam,
  type ProviderInvocationListParam,
  type ProviderInvocationListRes,
  type ProviderInvocation as UnifiedProviderInvocation
} from '@metorial-subspace/provider-utils';
import PQueue from 'p-queue';
import { shuttle } from '../client';

let mergeInvocation = (
  map: Map<string, UnifiedProviderInvocation>,
  invocation: UnifiedProviderInvocation
) => {
  let existing = map.get(invocation.id);
  if (!existing) {
    map.set(invocation.id, invocation);
    return;
  }

  existing.providerRunIds = Array.from(
    new Set([...existing.providerRunIds, ...invocation.providerRunIds])
  );
  existing.sessionMessageIds = Array.from(
    new Set([...existing.sessionMessageIds, ...invocation.sessionMessageIds])
  );
  existing.authConfigEventIds = Array.from(
    new Set([...existing.authConfigEventIds, ...invocation.authConfigEventIds])
  );
  existing.providerOAuthSetupIds = Array.from(
    new Set([...existing.providerOAuthSetupIds, ...invocation.providerOAuthSetupIds])
  );
};

let getObject = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

let getServerConnectionIdFromPayload = (payload: unknown) => {
  let object = getObject(payload);
  if (!object) return null;

  if (typeof object.serverConnectionId === 'string') {
    return object.serverConnectionId;
  }

  let event = getObject(object.event);
  if (event && typeof event.serverConnectionId === 'string') {
    return event.serverConnectionId;
  }

  return null;
};

let getShuttleFunctionProviderInvocationId = (functionInvocationId: string) =>
  createProviderInvocationId('shuttle.function_invocation', functionInvocationId);

let getShuttleServerConnectionProviderInvocationId = (serverConnectionId: string) =>
  createProviderInvocationId('shuttle.server_connection', serverConnectionId);

export class ProviderInvocation extends IProviderInvocation {
  override async listProviderInvocations(
    data: ProviderInvocationListParam
  ): Promise<ProviderInvocationListRes> {
    console.log('Listing provider invocations with data', data);

    let invocationMap = new Map<string, UnifiedProviderInvocation>();
    let queue = new PQueue({ concurrency: 5 });
    let serverConnectionLogsCache = new Map<
      string,
      Promise<Awaited<ReturnType<typeof shuttle.serverConnection.getLogsSync>>>
    >();
    let functionInvocationLogsCache = new Map<
      string,
      Promise<Awaited<ReturnType<typeof shuttle.functionServerInvocation.getLogs>>>
    >();

    let messageProviderRuns = data.inputs.sessionMessageIds?.length
      ? await db.sessionMessage.findMany({
          where: {
            id: { in: data.inputs.sessionMessageIds },
            providerRunOid: { not: null }
          },
          include: {
            providerRun: true
          }
        })
      : [];

    let providerRunIds = Array.from(
      new Set([
        ...(data.inputs.providerRunIds ?? []),
        ...messageProviderRuns.map(message => message.providerRun!.id)
      ])
    );

    let localConnections = providerRunIds.length
      ? await db.shuttleConnection.findMany({
          where: {
            providerRun: { id: { in: providerRunIds } }
          },
          include: {
            providerRun: true
          }
        })
      : [];

    let sessionMessageIdsByProviderRunId = new Map<string, string[]>();
    for (let message of messageProviderRuns) {
      let providerRunId = message.providerRun?.id;
      if (!providerRunId) continue;

      let list = sessionMessageIdsByProviderRunId.get(providerRunId) ?? [];
      list.push(message.id);
      sessionMessageIdsByProviderRunId.set(providerRunId, list);
    }

    let authConfigEvents = data.inputs.authConfigEventIds?.length
      ? await db.providerAuthConfigEvent.findMany({
          where: {
            id: { in: data.inputs.authConfigEventIds }
          },
          include: {
            oauthSetup: true
          }
        })
      : [];

    let remoteInvocations = localConnections.length
      ? await shuttle.functionServerInvocation.list({
          serverConnectionIds: localConnections.map(connection => connection.id)
        })
      : [];
    let serverConnectionIdsWithFunctionInvocations = new Set(
      remoteInvocations
        .map(invocation => invocation.serverConnectionId)
        .filter((id): id is string => Boolean(id))
    );

    let providerRunIdByConnectionId = new Map(
      localConnections.map(connection => [connection.id, connection.providerRun.id])
    );

    let getServerConnectionLogs = async (serverConnectionId: string) => {
      let cached = serverConnectionLogsCache.get(serverConnectionId);
      if (cached) return await cached;

      console.log(`Fetching logs for server connection ${serverConnectionId}`);

      let logsPromise = shuttle.serverConnection.getLogsSync({ serverConnectionId });
      serverConnectionLogsCache.set(serverConnectionId, logsPromise);

      let logs = await logsPromise;

      console.log(`Fetched ${logs.length} logs for server connection ${serverConnectionId}`);

      return logs;
    };

    let getFunctionInvocationLogs = async (functionInvocationId: string) => {
      let cached = functionInvocationLogsCache.get(functionInvocationId);
      if (cached) return await cached;

      let logsPromise = shuttle.functionServerInvocation.getLogs({ functionInvocationId });
      functionInvocationLogsCache.set(functionInvocationId, logsPromise);

      return await logsPromise;
    };

    console.log(
      `Processing ${localConnections.length} local connections and ${remoteInvocations.length} remote invocations`
    );

    await queue.addAll(
      localConnections
        .filter(connection => !serverConnectionIdsWithFunctionInvocations.has(connection.id))
        .map(connection => async () => {
          let logs = await getServerConnectionLogs(connection.id);
          let providerRunId = connection.providerRun.id;

          mergeInvocation(invocationMap, {
            id: getShuttleServerConnectionProviderInvocationId(connection.id),
            source: 'shuttle',
            type: 'tool_call',
            status: 'unknown',
            providerRunIds: [providerRunId],
            sessionMessageIds: sessionMessageIdsByProviderRunId.get(providerRunId) ?? [],
            authConfigEventIds: [],
            providerOAuthSetupIds: [],
            toolCallId: null,
            action: null,
            requests: [],
            responses: [],
            requestTraces: [],
            logs: logs.map(log => ({
              timestamp: log.timestamp,
              message: log.message,
              outputType: log.outputType
            })),
            attachments: [],
            error: null,
            provider: null,
            metadata: {
              serverConnectionId: connection.id
            },
            createdAt: connection.providerRun.createdAt
          });
        })
    );

    console.log(`Finished processing local connections, now processing remote invocations`);

    await queue.addAll(
      remoteInvocations.map(invocation => async () => {
        console.log(
          `Processing function invocation ${invocation.id} for server connection ${invocation.serverConnectionId}`
        );
        let logs = await getFunctionInvocationLogs(invocation.id);
        console.log(
          `Fetched ${logs.logs.length} logs for function invocation ${invocation.id}`
        );

        let providerRunId = invocation.serverConnectionId
          ? (providerRunIdByConnectionId.get(invocation.serverConnectionId) ?? null)
          : null;

        mergeInvocation(invocationMap, {
          id: getShuttleFunctionProviderInvocationId(invocation.id),
          source: 'shuttle',
          type: 'tool_call',
          status: invocation.isError ? 'failed' : 'succeeded',
          providerRunIds: providerRunId ? [providerRunId] : [],
          sessionMessageIds: providerRunId
            ? (sessionMessageIdsByProviderRunId.get(providerRunId) ?? [])
            : [],
          authConfigEventIds: [],
          providerOAuthSetupIds: [],
          toolCallId: null,
          action: null,
          requests: [],
          responses: [],
          requestTraces: [],
          logs: logs.logs.map(log => ({
            timestamp: log.timestamp,
            message: log.message,
            outputType: log.outputType
          })),
          attachments: [],
          error: invocation.isError
            ? {
                code: 'function_invocation_failed',
                message: 'Function invocation failed'
              }
            : null,
          provider: null,
          metadata: {
            serverConnectionId: invocation.serverConnectionId,
            functionServerId: invocation.functionServerId
          },
          createdAt: invocation.createdAt
        });
      })
    );

    console.log(`Finished processing remote invocations, now processing auth config events`);

    await queue.addAll(
      authConfigEvents.map(event => async () => {
        let type: UnifiedProviderInvocation['type'] = event.type.includes('oauth_setup')
          ? 'oauth_setup'
          : 'auth_config_event';

        if (event.providerInvocationId) {
          let parsedId = parseStoredProviderInvocationId({
            sourceType: event.sourceType,
            providerInvocationId: event.providerInvocationId
          });
          if (!parsedId || parsedId.sourceType !== 'shuttle.function_invocation') return;

          let invocation = await shuttle.functionServerInvocation.get({
            functionInvocationId: parsedId.sourceId
          });
          let logs = await getFunctionInvocationLogs(parsedId.sourceId);

          mergeInvocation(invocationMap, {
            id: getShuttleFunctionProviderInvocationId(invocation.id),
            source: 'shuttle',
            type,
            status: invocation.isError ? 'failed' : 'succeeded',
            providerRunIds:
              invocation.serverConnectionId &&
              providerRunIdByConnectionId.get(invocation.serverConnectionId)
                ? [providerRunIdByConnectionId.get(invocation.serverConnectionId)!]
                : [],
            sessionMessageIds: [],
            authConfigEventIds: [event.id],
            providerOAuthSetupIds: event.oauthSetup ? [event.oauthSetup.id] : [],
            toolCallId: null,
            action: null,
            requests: [],
            responses: [],
            requestTraces: [],
            logs: logs.logs.map(log => ({
              timestamp: log.timestamp,
              message: log.message,
              outputType: log.outputType
            })),
            attachments: [],
            error: invocation.isError
              ? {
                  code: 'function_invocation_failed',
                  message: 'Function invocation failed'
                }
              : null,
            provider: null,
            metadata: {
              serverConnectionId: invocation.serverConnectionId,
              functionServerId: invocation.functionServerId
            },
            createdAt: invocation.createdAt
          });
          return;
        }

        let serverConnectionId = getServerConnectionIdFromPayload(event.payload);
        if (!serverConnectionId) return;
        if (serverConnectionIdsWithFunctionInvocations.has(serverConnectionId)) return;

        let logs = await getServerConnectionLogs(serverConnectionId);
        let providerRunId = providerRunIdByConnectionId.get(serverConnectionId) ?? null;

        mergeInvocation(invocationMap, {
          id: getShuttleServerConnectionProviderInvocationId(serverConnectionId),
          source: 'shuttle',
          type,
          status: event.type.endsWith('_failed')
            ? 'failed'
            : event.type.endsWith('_completed') || event.type.endsWith('_succeeded')
              ? 'succeeded'
              : 'unknown',
          providerRunIds: providerRunId ? [providerRunId] : [],
          sessionMessageIds: providerRunId
            ? (sessionMessageIdsByProviderRunId.get(providerRunId) ?? [])
            : [],
          authConfigEventIds: [event.id],
          providerOAuthSetupIds: event.oauthSetup ? [event.oauthSetup.id] : [],
          toolCallId: null,
          action: null,
          requests: [],
          responses: [],
          requestTraces: [],
          logs: logs.map(log => ({
            timestamp: log.timestamp,
            message: log.message,
            outputType: log.outputType
          })),
          attachments: [],
          error: event.type.endsWith('_failed')
            ? {
                code: event.type,
                message: event.type
              }
            : null,
          provider: null,
          metadata: {
            serverConnectionId
          },
          createdAt: event.createdAt
        });
      })
    );

    console.log(
      `Finished processing provider invocations, total unique invocations: ${invocationMap.size}`
    );

    return {
      items: Array.from(invocationMap.values()).sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
      )
    };
  }

  override async getProviderInvocation(
    data: ProviderInvocationGetParam
  ): Promise<UnifiedProviderInvocation | null> {
    let relatedEvents = await db.providerAuthConfigEvent.findMany({
      where: {
        providerInvocationId: data.input.providerInvocationId,
        tenantOid: data.tenant.oid,
        environmentOid: data.environment.oid,
        solutionOid: data.solution.oid
      },
      include: {
        oauthSetup: true
      }
    });

    if (data.input.sourceType === 'shuttle.function_invocation') {
      let invocation = await shuttle.functionServerInvocation.get({
        functionInvocationId: data.input.sourceId
      });
      let logs = await shuttle.functionServerInvocation.getLogs({
        functionInvocationId: data.input.sourceId
      });
      let connection = invocation.serverConnectionId
        ? await db.shuttleConnection.findFirst({
            where: {
              id: invocation.serverConnectionId,
              providerRun: {
                tenantOid: data.tenant.oid,
                environmentOid: data.environment.oid,
                solutionOid: data.solution.oid
              }
            },
            include: {
              providerRun: true
            }
          })
        : null;
      let sessionMessages = connection
        ? await db.sessionMessage.findMany({
            where: {
              providerRunOid: connection.providerRunOid,
              tenantOid: data.tenant.oid,
              environmentOid: data.environment.oid,
              solutionOid: data.solution.oid
            },
            select: {
              id: true
            }
          })
        : [];

      let type: UnifiedProviderInvocation['type'] = relatedEvents.length
        ? relatedEvents.every(event => event.type.includes('oauth_setup'))
          ? 'oauth_setup'
          : 'auth_config_event'
        : 'tool_call';

      return {
        id: data.input.providerInvocationId,
        source: 'shuttle',
        type,
        status: invocation.isError ? 'failed' : 'succeeded',
        providerRunIds: connection ? [connection.providerRun.id] : [],
        sessionMessageIds: sessionMessages.map(message => message.id),
        authConfigEventIds: relatedEvents.map(event => event.id),
        providerOAuthSetupIds: Array.from(
          new Set(
            relatedEvents
              .map(event => event.oauthSetup?.id)
              .filter((id): id is string => Boolean(id))
          )
        ),
        toolCallId: null,
        action: null,
        requests: [],
        responses: [],
        requestTraces: [],
        logs: logs.logs.map(log => ({
          timestamp: log.timestamp,
          message: log.message,
          outputType: log.outputType
        })),
        attachments: [],
        error: invocation.isError
          ? {
              code: 'function_invocation_failed',
              message: 'Function invocation failed'
            }
          : null,
        provider: null,
        metadata: {
          serverConnectionId: invocation.serverConnectionId,
          functionServerId: invocation.functionServerId
        },
        createdAt: invocation.createdAt
      };
    }

    if (data.input.sourceType !== 'shuttle.server_connection') return null;

    let logs = await shuttle.serverConnection.getLogsSync({
      serverConnectionId: data.input.sourceId
    });
    let connection = await db.shuttleConnection.findFirst({
      where: {
        id: data.input.sourceId,
        providerRun: {
          tenantOid: data.tenant.oid,
          environmentOid: data.environment.oid,
          solutionOid: data.solution.oid
        }
      },
      include: {
        providerRun: true
      }
    });
    let sessionMessages = connection
      ? await db.sessionMessage.findMany({
          where: {
            providerRunOid: connection.providerRunOid,
            tenantOid: data.tenant.oid,
            environmentOid: data.environment.oid,
            solutionOid: data.solution.oid
          },
          select: {
            id: true
          }
        })
      : [];

    let type: UnifiedProviderInvocation['type'] = relatedEvents.length
      ? relatedEvents.every(event => event.type.includes('oauth_setup'))
        ? 'oauth_setup'
        : 'auth_config_event'
      : 'tool_call';
    let status: UnifiedProviderInvocation['status'] = relatedEvents.some(event =>
      event.type.endsWith('_failed')
    )
      ? 'failed'
      : relatedEvents.some(
            event => event.type.endsWith('_completed') || event.type.endsWith('_succeeded')
          )
        ? 'succeeded'
        : 'unknown';

    return {
      id: data.input.providerInvocationId,
      source: 'shuttle',
      type,
      status,
      providerRunIds: connection ? [connection.providerRun.id] : [],
      sessionMessageIds: sessionMessages.map(message => message.id),
      authConfigEventIds: relatedEvents.map(event => event.id),
      providerOAuthSetupIds: Array.from(
        new Set(
          relatedEvents
            .map(event => event.oauthSetup?.id)
            .filter((id): id is string => Boolean(id))
        )
      ),
      toolCallId: null,
      action: null,
      requests: [],
      responses: [],
      requestTraces: [],
      logs: logs.map(log => ({
        timestamp: log.timestamp,
        message: log.message,
        outputType: log.outputType
      })),
      attachments: [],
      error:
        status === 'failed'
          ? {
              code: 'server_connection_failed',
              message: 'Server connection failed'
            }
          : null,
      provider: null,
      metadata: {
        serverConnectionId: data.input.sourceId
      },
      createdAt: connection?.providerRun.createdAt ?? relatedEvents[0]?.createdAt ?? new Date()
    };
  }
}
