import { db } from '@metorial-subspace/db';
import {
  IProviderInvocation,
  type ProviderInvocation as UnifiedProviderInvocation,
  type ProviderInvocationListParam,
  type ProviderInvocationListRes
} from '@metorial-subspace/provider-utils';
import PQueue from 'p-queue';
import { getTenantForSlates, slates } from '../client';

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

let toInvocationError = (value: unknown): { code: string; message: string } | null => {
  if (!value || typeof value !== 'object') return null;
  if (!('code' in value) || typeof value.code !== 'string') return null;

  return {
    code: value.code,
    message:
      'message' in value && typeof value.message === 'string' ? value.message : value.code
  };
};

export class ProviderInvocation extends IProviderInvocation {
  override async listProviderInvocations(
    data: ProviderInvocationListParam
  ): Promise<ProviderInvocationListRes> {
    let tenant = await getTenantForSlates(data.tenant);
    let invocationMap = new Map<string, UnifiedProviderInvocation>();
    let queue = new PQueue({ concurrency: 5 });

    let localToolCalls = await db.slateToolCall.findMany({
      where: {
        OR: [
          data.inputs.providerRunIds?.length
            ? [{ session: { providerRun: { id: { in: data.inputs.providerRunIds } } } }]
            : [],
          data.inputs.sessionMessageIds?.length
            ? [{ sessionMessages: { some: { id: { in: data.inputs.sessionMessageIds } } } }]
            : []
        ].flat()
      },
      include: {
        session: {
          include: {
            providerRun: true
          }
        },
        sessionMessages: true
      }
    });

    await queue.addAll(
      localToolCalls.map(localToolCall => async () => {
        let remote = await slates.slateSessionToolCall.getLogs({
          tenantId: tenant.id,
          slateSessionToolCallId: localToolCall.id
        });

        mergeInvocation(invocationMap, {
          id: remote.invocation.id,
          source: 'slates',
          type: 'tool_call',
          status:
            remote.invocation.status === 'processing_result'
              ? 'processing'
              : remote.invocation.status === 'succeeded'
                ? 'succeeded'
                : 'failed',
          providerRunIds: [localToolCall.session.providerRun.id],
          sessionMessageIds: localToolCall.sessionMessages.map(message => message.id),
          authConfigEventIds: [],
          providerOAuthSetupIds: [],
          toolCallId: remote.id,
          action: remote.action,
          requests: remote.invocation.requests ?? [],
          responses: remote.invocation.responses ?? [],
          requestTraces: remote.invocation.requestTraces ?? [],
          logs: (remote.invocation.logs ?? []).map(log => ({
            timestamp: log.timestamp,
            message: log.message,
            outputType: 'stdout'
          })),
          attachments: remote.invocation.attachments ?? remote.attachments ?? [],
          error: toInvocationError(remote.invocation.error) ?? toInvocationError(remote.error),
          provider: remote.invocation.provider ?? null,
          metadata: {
            slateSessionId: remote.sessionId,
            slateVersionId: remote.slateVersionId
          },
          createdAt: remote.createdAt
        });
      })
    );

    let authConfigEvents = data.inputs.authConfigEventIds?.length
      ? await db.authConfigEvent.findMany({
          where: {
            id: { in: data.inputs.authConfigEventIds },
            providerInvocationId: { not: null },
            sourceType: { in: ['slates.auth_config_event', 'slates.oauth_setup_event'] }
          },
          include: {
            oauthSetup: true
          }
        })
      : [];

    await queue.addAll(
      authConfigEvents.map(event => async () => {
        if (!event.providerInvocationId) return;

        let remote = await slates.slateInvocation.DANGEROUSLY_get({
          slateInvocationId: event.providerInvocationId
        });

        mergeInvocation(invocationMap, {
          id: remote.id,
          source: 'slates',
          type: event.sourceType === 'slates.auth_config_event' ? 'auth_config_event' : 'oauth_setup',
          status:
            remote.status === 'processing_result'
              ? 'processing'
              : remote.status === 'succeeded'
                ? 'succeeded'
                : 'failed',
          providerRunIds: [],
          sessionMessageIds: [],
          authConfigEventIds: [event.id],
          providerOAuthSetupIds: event.oauthSetup ? [event.oauthSetup.id] : [],
          toolCallId: null,
          action: null,
          requests: remote.requests ?? [],
          responses: remote.responses ?? [],
          requestTraces: remote.requestTraces ?? [],
          logs: (remote.logs ?? []).map(log => ({
            timestamp: log.timestamp,
            message: log.message,
            outputType: 'stdout'
          })),
          attachments: remote.attachments ?? [],
          error: toInvocationError(remote.error),
          provider: remote.provider ?? null,
          metadata: {
            slateDeploymentId: remote.slateDeploymentId,
            slateVersionId: remote.slateVersionId
          },
          createdAt: remote.createdAt
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
