import type { UsageInstanceRef, UsageSessionDims } from './subspace';
import type { UsageEvent } from './types';

export type UsageMessageRow = {
  type: string;
  status: string;
  createdAt: Date;
  completedAt: Date | null;
  methodOrToolKey?: string | null;
  sessionProvider?: {
    provider?: { id: string } | null;
    deployment?: { id: string } | null;
  } | null;
  toolCall?: { tool?: { key: string } | null } | null;
};

export type UsageConnectionRow = {
  createdAt: Date;
  disconnectedAt?: Date | null;
  lastConnectedAt?: Date | null;
};

export type UsageSessionErrorRow = {
  type: string;
  createdAt: Date;
  providerRun?: { provider?: { id: string } | null } | null;
};

export type UsageAuthEventRow = {
  status: string;
  createdAt: Date;
  provider?: { id: string } | null;
};

export type UsageAuthErrorRow = {
  type: string;
  createdAt: Date;
  provider?: { id: string } | null;
};

type UsageEventContext = {
  instance: UsageInstanceRef;
  session?: UsageSessionDims;
  consumerId?: string | null;
  agentId?: string | null;
};

let base = (ctx: UsageEventContext) => ({
  instanceId: ctx.instance.instanceId,
  organizationId: ctx.instance.organizationId
});

let sessionDims = (ctx: UsageEventContext) => ({
  consumerId: ctx.consumerId ?? null,
  agentId: ctx.agentId ?? null,
  magicMcpServerId: ctx.session?.magicMcpServerId ?? null,
  integrationId: ctx.session?.integrationId ?? null
});

let mcpProtocolMethods = new Set(['initialize', 'ping']);
let mcpProtocolPrefixes = [
  'notifications/',
  'tools/',
  'resources/',
  'prompts/',
  'completion/',
  'logging/',
  'sampling/',
  'roots/',
  'elicitation/'
];

export let isMcpProtocolMethod = (key: string | null | undefined) =>
  !!key &&
  (mcpProtocolMethods.has(key) || mcpProtocolPrefixes.some(prefix => key.startsWith(prefix)));

export let buildMessageUsageEvent = (
  message: UsageMessageRow,
  ctx: UsageEventContext
): UsageEvent => {
  let isToolCall =
    message.type == 'tool_call' &&
    (!!message.toolCall?.tool || !isMcpProtocolMethod(message.methodOrToolKey));

  return {
    ...base(ctx),
    kind: isToolCall ? 'tool_call' : 'message',
    ts: message.createdAt,
    isError: message.status == 'failed',
    durationMs: message.completedAt
      ? message.completedAt.getTime() - message.createdAt.getTime()
      : null,
    dims: {
      ...sessionDims(ctx),
      providerId: message.sessionProvider?.provider?.id ?? null,
      deploymentId: message.sessionProvider?.deployment?.id ?? null,
      toolKey: isToolCall
        ? (message.toolCall?.tool?.key ?? message.methodOrToolKey ?? null)
        : null
    }
  };
};

export let buildSessionUsageEvent = (
  session: { createdAt: Date; providerIds: string[] },
  ctx: UsageEventContext
): UsageEvent => {
  let providerIds = [...new Set(session.providerIds)];

  return {
    ...base(ctx),
    kind: 'session',
    ts: session.createdAt,
    dims: {
      ...sessionDims(ctx),
      providerId: providerIds.length == 1 ? providerIds[0] : null
    }
  };
};

export let buildConnectionUsageEvent = (
  connection: UsageConnectionRow,
  ctx: UsageEventContext
): UsageEvent => ({
  ...base(ctx),
  kind: 'connection',
  ts: connection.createdAt,
  dims: sessionDims(ctx)
});

export let buildConnectionTimeUsageEvent = (
  connection: UsageConnectionRow & { disconnectedAt: Date },
  ctx: UsageEventContext
): UsageEvent => {
  let connectedAt = connection.lastConnectedAt ?? connection.createdAt;

  return {
    ...base(ctx),
    kind: 'connection_time',
    ts: connection.disconnectedAt,
    durationMs: Math.max(0, connection.disconnectedAt.getTime() - connectedAt.getTime()),
    dims: sessionDims(ctx)
  };
};

export let buildSessionErrorUsageEvent = (
  error: UsageSessionErrorRow,
  ctx: UsageEventContext
): UsageEvent => ({
  ...base(ctx),
  kind: 'session_error',
  ts: error.createdAt,
  isError: true,
  dims: {
    ...sessionDims(ctx),
    providerId: error.providerRun?.provider?.id ?? null,
    errorType: error.type
  }
});

export let buildAuthEventUsageEvent = (
  event: UsageAuthEventRow,
  ctx: UsageEventContext
): UsageEvent => ({
  ...base(ctx),
  kind: 'auth_event',
  ts: event.createdAt,
  isError: event.status == 'failed',
  dims: { providerId: event.provider?.id ?? null }
});

export let buildConsumerUsageEvent = (
  consumer: { consumerId: string; createdAt: Date },
  ctx: UsageEventContext
): UsageEvent => ({
  ...base(ctx),
  kind: 'consumer',
  ts: consumer.createdAt,
  dims: { consumerId: consumer.consumerId }
});

export let buildAuthErrorUsageEvent = (
  error: UsageAuthErrorRow,
  ctx: UsageEventContext
): UsageEvent => ({
  ...base(ctx),
  kind: 'auth_error',
  ts: error.createdAt,
  isError: true,
  dims: { providerId: error.provider?.id ?? null, errorType: error.type }
});
