import { describe, expect, it } from 'vitest';
import { accumulateUsageEvent, type UsageAccumulatedBucket } from '../src/lib/bucket';
import {
  buildAuthErrorUsageEvent,
  buildAuthEventUsageEvent,
  buildMessageUsageEvent,
  buildSessionErrorUsageEvent,
  buildSessionUsageEvent,
  isMcpProtocolMethod
} from '../src/lib/events';

let ctx = { instance: { instanceId: 'ins_1', organizationId: 'org_1' } } as any;

let message = (d: { methodOrToolKey: string; toolKey?: string }) => ({
  type: 'tool_call',
  status: 'succeeded',
  createdAt: new Date('2026-10-01T00:00:00Z'),
  completedAt: null,
  methodOrToolKey: d.methodOrToolKey,
  toolCall: d.toolKey ? { tool: { key: d.toolKey } } : null
});

describe('authentication usage events', () => {
  it.each([
    { type: 'oauth_setup_completed', status: 'succeeded', isError: false },
    { type: 'access_token_received', status: 'succeeded', isError: false },
    { type: 'exchange_authorization_code', status: 'failed', isError: true },
    { type: 'oauth_setup_failed', status: 'succeeded', isError: true },
    { type: 'oauth_token_refresh_failed', status: 'succeeded', isError: true },
    { type: 'oauth_callback_error', status: 'succeeded', isError: true }
  ])('classifies $type with stored status $status', ({ type, status, isError }) => {
    let createdAt = new Date('2026-10-01T00:00:00Z');
    let event = buildAuthEventUsageEvent(
      { type, status, createdAt, provider: { id: 'pro_1' } },
      ctx
    );
    let buckets = new Map<string, UsageAccumulatedBucket>();

    accumulateUsageEvent(buckets, event);

    expect(event).toMatchObject({
      kind: 'auth_event',
      ts: createdAt,
      isError,
      dims: { providerId: 'pro_1' }
    });
    expect([...buckets.values()][0]!.counters).toMatchObject({
      count: 1,
      errorCount: isError ? 1 : 0
    });
  });
});

describe('session and error usage events', () => {
  let createdAt = new Date('2026-10-01T00:00:00Z');
  let sessionCtx = {
    ...ctx,
    consumerId: 'con_1',
    session: { magicMcpServerId: 'mms_1', integrationId: 'int_1' }
  };

  it.each([
    { providerIds: [] },
    { providerIds: ['pro_1'] },
    { providerIds: ['pro_1', 'pro_1'] },
    { providerIds: ['pro_1', 'pro_2'] }
  ])('counts a session once with provider IDs $providerIds', ({ providerIds }) => {
    let buckets = new Map<string, UsageAccumulatedBucket>();
    let event = buildSessionUsageEvent({ createdAt, providerIds }, sessionCtx);

    accumulateUsageEvent(buckets, event);

    expect(event.kind).toBe('session');
    expect(event.ts).toBe(createdAt);
    expect(event.dims).toMatchObject({
      consumerId: 'con_1',
      magicMcpServerId: 'mms_1',
      integrationId: 'int_1',
      providerId: new Set(providerIds).size == 1 ? providerIds[0] : null
    });
    expect([...buckets.values()][0]!.counters.count).toBe(1);
  });

  it.each([
    'message_processing_timeout',
    'message_processing_provider_error',
    'message_processing_system_error'
  ])('records session error occurrences of type %s', type => {
    let event = buildSessionErrorUsageEvent(
      { type, createdAt, providerRun: { provider: { id: 'pro_1' } } },
      sessionCtx
    );
    let buckets = new Map<string, UsageAccumulatedBucket>();

    accumulateUsageEvent(buckets, event);
    accumulateUsageEvent(buckets, event);

    expect(event.kind).toBe('session_error');
    expect(event.ts).toBe(createdAt);
    expect(event.dims).toMatchObject({
      providerId: 'pro_1',
      errorType: type,
      consumerId: 'con_1',
      integrationId: 'int_1'
    });
    expect([...buckets.values()][0]!.counters).toMatchObject({ count: 2, errorCount: 2 });
  });

  it('records auth error occurrences with their provider and error type', () => {
    let event = buildAuthErrorUsageEvent(
      { type: 'authentication_failed', createdAt, provider: { id: 'pro_1' } },
      ctx
    );

    expect(event).toMatchObject({
      instanceId: 'ins_1',
      organizationId: 'org_1',
      kind: 'auth_error',
      ts: createdAt,
      isError: true,
      dims: { providerId: 'pro_1', errorType: 'authentication_failed' }
    });
  });
});

describe('isMcpProtocolMethod', () => {
  it('detects MCP protocol methods', () => {
    for (let key of ['initialize', 'ping', 'tools/list', 'notifications/initialized']) {
      expect(isMcpProtocolMethod(key)).toBe(true);
    }
  });

  it('keeps regular tool keys', () => {
    for (let key of ['oauth_me', 'metorial_chat$workspace.list', 'linear_tool_list-teams']) {
      expect(isMcpProtocolMethod(key)).toBe(false);
    }
    expect(isMcpProtocolMethod(null)).toBe(false);
  });
});

describe('buildMessageUsageEvent', () => {
  it('records MCP protocol methods as messages without a tool', () => {
    let event = buildMessageUsageEvent(message({ methodOrToolKey: 'tools/list' }), ctx);

    expect(event.kind).toBe('message');
    expect(event.dims?.toolKey).toBeNull();
  });

  it('records tool calls with their tool key', () => {
    let event = buildMessageUsageEvent(
      message({ methodOrToolKey: 'oauth_me', toolKey: 'me' }),
      ctx
    );

    expect(event.kind).toBe('tool_call');
    expect(event.dims?.toolKey).toBe('me');
  });

  it('records the agent that sent the message', () => {
    let event = buildMessageUsageEvent(
      message({ methodOrToolKey: 'oauth_me', toolKey: 'me' }),
      {
        ...ctx,
        agentId: 'agi_1'
      }
    );

    expect(event.dims?.agentId).toBe('agi_1');
  });

  it.each(['succeeded', 'failed'])('records MCP tool calls with status %s', status => {
    let event = buildMessageUsageEvent(
      {
        ...message({ methodOrToolKey: 'get_file_contents', toolKey: 'get_file_contents' }),
        type: 'mcp_message',
        status
      },
      ctx
    );

    expect(event.kind).toBe('tool_call');
    expect(event.dims?.toolKey).toBe('get_file_contents');
    expect(event.isError).toBe(status == 'failed');
  });

  it('keeps MCP protocol traffic separate from tool calls', () => {
    let event = buildMessageUsageEvent(
      { ...message({ methodOrToolKey: 'tools/list' }), type: 'mcp_message' },
      ctx
    );

    expect(event.kind).toBe('message');
    expect(event.dims?.toolKey).toBeNull();
  });

  it('recognizes a linked MCP tool call even when its key matches a protocol method', () => {
    let event = buildMessageUsageEvent(
      { ...message({ methodOrToolKey: 'ping', toolKey: 'ping' }), type: 'mcp_message' },
      ctx
    );

    expect(event.kind).toBe('tool_call');
    expect(event.dims?.toolKey).toBe('ping');
  });

  it('counts successful tool calls from both transports in the same usage bucket', () => {
    let buckets = new Map<string, UsageAccumulatedBucket>();

    for (let type of ['tool_call', 'mcp_message']) {
      for (let status of ['succeeded', 'succeeded', 'failed']) {
        let event = buildMessageUsageEvent(
          {
            ...message({ methodOrToolKey: 'get_file_contents', toolKey: 'get_file_contents' }),
            type,
            status
          },
          ctx
        );

        accumulateUsageEvent(buckets, event);
      }
    }

    expect(buckets.size).toBe(1);

    let { count, errorCount } = [...buckets.values()][0]!.counters;

    expect(count).toBe(6);
    expect(errorCount).toBe(2);
    expect(count - errorCount).toBe(4);
  });
});
