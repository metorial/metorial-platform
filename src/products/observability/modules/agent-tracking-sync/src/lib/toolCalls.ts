import { isServiceError } from '@lowerdeck/error';
import type { UsageSessionDims } from '@metorial/module-usage';

let retriedClientStatuses = new Set([401, 403, 404, 408, 429]);

let storeMissingStatus = 412;

export type PushedMessage = {
  oid: bigint;
  createdAt: Date;
  session: { oid: bigint; id: string };
  sessionProvider: {
    provider: { id: string } | null;
    deployment: { id: string } | null;
  } | null;
  toolCall: {
    id: string;
    toolKey: string;
    clientCallId: string | null;
    clientCallSource: string | null;
  } | null;
};

export type ToolCallCursor = { createdAt: string; oid: string };

export let pushedMessageSelect = {
  oid: true,
  createdAt: true,
  session: { select: { oid: true, id: true } },
  sessionProvider: {
    select: {
      provider: { select: { id: true } },
      deployment: { select: { id: true } }
    }
  },
  toolCall: {
    select: { id: true, toolKey: true, clientCallId: true, clientCallSource: true }
  }
} as const;

export let windowWhere = (d: { since: string; upTo: string; after?: ToolCallCursor }) => {
  let upTo = new Date(d.upTo);
  if (!d.after) return { createdAt: { gte: new Date(d.since), lt: upTo } };

  let createdAt = new Date(d.after.createdAt);
  let oid = BigInt(d.after.oid);

  return {
    createdAt: { gte: createdAt, lt: upTo },
    OR: [{ createdAt: { gt: createdAt } }, { createdAt, oid: { gt: oid } }]
  };
};

export let cursorOf = (message: Pick<PushedMessage, 'createdAt' | 'oid'>): ToolCallCursor => ({
  createdAt: message.createdAt.toISOString(),
  oid: message.oid.toString()
});

export let linkFailureOf = (
  error: unknown
): { action: 'skip' | 'stop'; status: number } | undefined => {
  if (!isServiceError(error)) return undefined;

  let status = error.data.status;
  if (status == storeMissingStatus) return { action: 'stop', status };
  if (status < 400 || status >= 500 || retriedClientStatuses.has(status)) return undefined;

  return { action: 'skip', status };
};

let present = (value: string | null | undefined): value is string =>
  typeof value == 'string' && value.length > 0;

export let toolCallLinksOf = (d: {
  messages: PushedMessage[];
  sessionDims: Map<string, UsageSessionDims>;
  toolDetails: boolean;
}) =>
  d.messages.flatMap(message => {
    let toolCall = message.toolCall;
    let providerId = message.sessionProvider?.provider?.id;

    if (
      !toolCall ||
      !present(toolCall.id) ||
      !present(toolCall.clientCallId) ||
      !present(toolCall.clientCallSource) ||
      !present(providerId)
    ) {
      return [];
    }

    let deploymentId = message.sessionProvider?.deployment?.id;
    let dims = d.sessionDims.get(message.session.oid.toString());

    return [
      {
        clientFamily: toolCall.clientCallSource,
        toolCallId: toolCall.clientCallId,
        calledAt: message.createdAt,
        metorial: {
          toolCallId: toolCall.id,
          providerId,
          ...(d.toolDetails && present(toolCall.toolKey) ? { toolKey: toolCall.toolKey } : {}),
          ...(present(deploymentId) ? { deploymentId } : {}),
          ...(present(dims?.integrationId) ? { integrationId: dims.integrationId } : {}),
          ...(present(dims?.magicMcpServerId)
            ? { magicMcpServerId: dims.magicMcpServerId }
            : {})
        }
      }
    ];
  });
