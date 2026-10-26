import { describe, expect, it } from 'vitest';
import { buildMessageUsageEvent, isMcpProtocolMethod } from '../src/lib/events';

let ctx = { instance: { instanceId: 'ins_1', organizationId: 'org_1' } } as any;

let message = (d: { methodOrToolKey: string; toolKey?: string }) => ({
  type: 'tool_call',
  status: 'succeeded',
  createdAt: new Date('2026-10-01T00:00:00Z'),
  completedAt: null,
  methodOrToolKey: d.methodOrToolKey,
  toolCall: d.toolKey ? { tool: { key: d.toolKey } } : null
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
});

describe('profile usage scope', () => {
  it('keeps calls from profiles of the same consumer in separate buckets', async () => {
    let { encodeUsageBucketKey } = await import('../src/lib/bucket');
    let makeEvent = (consumerProfileId: string) =>
      buildMessageUsageEvent(message({ methodOrToolKey: 'search' }), {
        ...ctx,
        consumerId: 'inc_shared',
        consumerProfileId
      });
    let first = makeEvent('cop_portal');
    let second = makeEvent('cop_member');

    expect(first.dims?.consumerId).toBe(second.dims?.consumerId);
    expect(first.dims?.consumerProfileId).toBe('cop_portal');
    expect(encodeUsageBucketKey(first)).not.toBe(encodeUsageBucketKey(second));
  });
});
