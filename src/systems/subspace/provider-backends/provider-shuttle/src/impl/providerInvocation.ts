import { db } from '@metorial-subspace/db';
import {
  IProviderInvocation,
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

export class ProviderInvocation extends IProviderInvocation {
  override async listProviderInvocations(
    data: ProviderInvocationListParam
  ): Promise<ProviderInvocationListRes> {
    let invocationMap = new Map<string, UnifiedProviderInvocation>();
    let queue = new PQueue({ concurrency: 5 });

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
      ? await db.authConfigEvent.findMany({
          where: {
            id: { in: data.inputs.authConfigEventIds },
            providerInvocationId: { not: null }
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

    let providerRunIdByConnectionId = new Map(
      localConnections.map(connection => [connection.id, connection.providerRun.id])
    );

    await queue.addAll(
      remoteInvocations.map(invocation => async () => {
        let logs = await shuttle.functionServerInvocation.getLogs({
          functionInvocationId: invocation.id
        });

        let providerRunId = invocation.serverConnectionId
          ? (providerRunIdByConnectionId.get(invocation.serverConnectionId) ?? null)
          : null;

        mergeInvocation(invocationMap, {
          id: invocation.id,
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

    await queue.addAll(
      authConfigEvents.map(event => async () => {
        if (!event.providerInvocationId) return;

        let invocation = await shuttle.functionServerInvocation.get({
          functionInvocationId: event.providerInvocationId
        });
        let logs = await shuttle.functionServerInvocation.getLogs({
          functionInvocationId: event.providerInvocationId
        });

        mergeInvocation(invocationMap, {
          id: invocation.id,
          source: 'shuttle',
          type: event.type.includes('oauth_setup') ? 'oauth_setup' : 'auth_config_event',
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
      })
    );

    return {
      items: Array.from(invocationMap.values()).sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
      )
    };
  }
}
