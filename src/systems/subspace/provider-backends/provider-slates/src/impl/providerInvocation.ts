import { db } from '@metorial-subspace/db';
import {
  IProviderInvocation,
  type ProviderInvocationGetParam,
  type ProviderInvocationListParam,
  type ProviderInvocationListRes,
  type ProviderInvocation as UnifiedProviderInvocation,
  createProviderInvocationId,
  parseStoredProviderInvocationId
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

let getInvocationStatus = (status: string) =>
  status === 'processing_result'
    ? ('processing' as const)
    : status === 'succeeded'
      ? ('succeeded' as const)
      : ('failed' as const);

let toLogs = (logs: Array<{ timestamp: number | Date; message: string }> = []) =>
  logs.map(log => ({
    timestamp: log.timestamp,
    message: log.message,
    outputType: 'stdout'
  }));

let getSlateProviderInvocationId = (slateInvocationId: string) =>
  createProviderInvocationId('slate.invocation', slateInvocationId);

let getCallbackInvocationActionName = (type: string) => {
  switch (type) {
    case 'webhook_handle':
      return 'Receive Webhook Event';
    case 'poll':
      return 'Poll For Callback Events';
    case 'map_event':
      return 'Process Callback Result';
    default:
      return 'Callback Invocation';
  }
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
          id: getSlateProviderInvocationId(remote.invocation.id),
          source: 'slates',
          type: 'tool_call',
          status: getInvocationStatus(remote.invocation.status),
          providerRunIds: [localToolCall.session.providerRun.id],
          sessionMessageIds: localToolCall.sessionMessages.map(message => message.id),
          authConfigEventIds: [],
          providerOAuthSetupIds: [],
          toolCallId: remote.id,
          action: remote.action,
          requests: remote.invocation.requests ?? [],
          responses: remote.invocation.responses ?? [],
          requestTraces: remote.invocation.requestTraces ?? [],
          logs: toLogs(remote.invocation.logs ?? []),
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

    let callbackInvocations = data.inputs.callbackEventSourceIds?.length
      ? (
          await slates.slateTriggerInvocation.list({
            tenantId: tenant.id,
            slateTriggerEventInputIds: data.inputs.callbackEventSourceIds,
            limit: data.inputs.callbackEventSourceIds.length * 3
          })
        ).items
      : [];

    await queue.addAll(
      callbackInvocations.map(triggerInvocation => async () => {
        let remote = triggerInvocation.invocation;

        mergeInvocation(invocationMap, {
          id: getSlateProviderInvocationId(remote.id),
          source: 'slates',
          type: 'tool_call',
          status: getInvocationStatus(remote.status),
          providerRunIds: [],
          sessionMessageIds: [],
          authConfigEventIds: [],
          providerOAuthSetupIds: [],
          toolCallId: null,
          action: {
            id: triggerInvocation.id,
            key: triggerInvocation.type,
            name: getCallbackInvocationActionName(triggerInvocation.type)
          },
          requests: remote.requests ?? [],
          responses: remote.responses ?? [],
          requestTraces: remote.requestTraces ?? [],
          logs: toLogs(remote.logs ?? []),
          attachments: remote.attachments ?? [],
          error: toInvocationError(remote.error),
          provider: remote.provider ?? null,
          metadata: {
            slateTriggerInvocationId: triggerInvocation.id,
            slateTriggerInvocationType: triggerInvocation.type,
            slateTriggerEventId: triggerInvocation.triggerEventId
          },
          createdAt: remote.createdAt
        });
      })
    );

    let authConfigEvents = data.inputs.authConfigEventIds?.length
      ? await db.providerAuthConfigEvent.findMany({
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
        let parsedId = parseStoredProviderInvocationId({
          sourceType: event.sourceType,
          providerInvocationId: event.providerInvocationId
        });
        if (!parsedId || parsedId.sourceType !== 'slate.invocation') return;

        let remote = await slates.slateInvocation.DANGEROUSLY_get({
          slateInvocationId: parsedId.sourceId
        });

        mergeInvocation(invocationMap, {
          id: getSlateProviderInvocationId(remote.id),
          source: 'slates',
          type:
            event.sourceType === 'slates.auth_config_event'
              ? 'auth_config_event'
              : 'oauth_setup',
          status: getInvocationStatus(remote.status),
          providerRunIds: [],
          sessionMessageIds: [],
          authConfigEventIds: [event.id],
          providerOAuthSetupIds: event.oauthSetup ? [event.oauthSetup.id] : [],
          toolCallId: null,
          action: null,
          requests: remote.requests ?? [],
          responses: remote.responses ?? [],
          requestTraces: remote.requestTraces ?? [],
          logs: toLogs(remote.logs ?? []),
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

  override async getProviderInvocation(
    data: ProviderInvocationGetParam
  ): Promise<UnifiedProviderInvocation | null> {
    if (data.input.sourceType !== 'slate.invocation') return null;

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

    let remote = await slates.slateInvocation.DANGEROUSLY_get({
      slateInvocationId: data.input.sourceId
    });

    let type: UnifiedProviderInvocation['type'] = 'unknown';
    if (relatedEvents.length > 0) {
      type = relatedEvents.every(
        event =>
          event.sourceType === 'slates.oauth_setup_event' ||
          event.sourceType === 'slates.oauth_setup'
      )
        ? 'oauth_setup'
        : 'auth_config_event';
    }

    return {
      id: data.input.providerInvocationId,
      source: 'slates',
      type,
      status: getInvocationStatus(remote.status),
      providerRunIds: [],
      sessionMessageIds: [],
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
      requests: remote.requests ?? [],
      responses: remote.responses ?? [],
      requestTraces: remote.requestTraces ?? [],
      logs: toLogs(remote.logs ?? []),
      attachments: remote.attachments ?? [],
      error: toInvocationError(remote.error),
      provider: remote.provider ?? null,
      metadata: {
        slateDeploymentId: remote.slateDeploymentId,
        slateVersionId: remote.slateVersionId
      },
      createdAt: remote.createdAt
    };
  }
}
