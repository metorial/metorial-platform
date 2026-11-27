import { eventually, uniqueId } from '@lowerdeck/testing-tools';
import { describe, expect, it } from 'vitest';
import { agentTracking, createHookToken, createToolDetailsHookToken, ingest } from './support';

let sendToolCall = async (d: { secret: string; sessionId: string; toolCallId: string }) => {
  let response = await ingest('/v1/ingest/hooks/claude-code', {
    credential: d.secret,
    body: JSON.stringify({
      session_id: d.sessionId,
      hook_event_name: 'PostToolUse',
      tool_use_id: d.toolCallId,
      tool_name: 'mcp__linear__create_issue',
      duration_ms: 250
    })
  });

  expect(response.status).toBe(200);
};

let link = (toolCallId: string, metorial: { toolCallId: string; providerId: string }) => ({
  clientFamily: 'claude-code',
  toolCallId,
  calledAt: new Date(),
  metorial: { ...metorial, toolKey: 'create_issue', integrationId: uniqueId('int') }
});

let sessionWithProviders = async (d: {
  organizationId: string;
  instanceId: string;
  providerIds: string[];
}) =>
  await eventually(
    async () => {
      let { items } = await agentTracking().session.list({
        organizationId: d.organizationId,
        instanceIds: [d.instanceId]
      });
      expect(items).toHaveLength(1);
      expect(items[0]!.summary?.metorial.providerIds).toEqual(d.providerIds);

      return items[0]!;
    },
    { timeoutMs: 30_000 }
  );

describe('tool call links', () => {
  it('adds the provider to the session whether the link or the records came first', async () => {
    let { organization, instance, secret } = await createToolDetailsHookToken();
    let sessionId = uniqueId('session');
    let early = uniqueId('toolu');
    let late = uniqueId('toolu');
    let providerA = uniqueId('pro');
    let providerB = uniqueId('pro');

    await agentTracking().toolCallLink.upsert({
      organizationId: organization.id,
      instanceId: instance.id,
      links: [link(early, { toolCallId: uniqueId('tcal'), providerId: providerA })]
    });
    await sendToolCall({ secret, sessionId, toolCallId: early });

    await sessionWithProviders({
      organizationId: organization.id,
      instanceId: instance.id,
      providerIds: [providerA]
    });

    await sendToolCall({ secret, sessionId, toolCallId: late });
    let result = await agentTracking().toolCallLink.upsert({
      organizationId: organization.id,
      instanceId: instance.id,
      links: [link(late, { toolCallId: uniqueId('tcal'), providerId: providerB })]
    });
    expect(result).toMatchObject({ object: 'agent_tracking#tool_call_links', written: 1 });

    let session = await sessionWithProviders({
      organizationId: organization.id,
      instanceId: instance.id,
      providerIds: [providerA, providerB].sort()
    });

    let filtered = await agentTracking().session.list({
      organizationId: organization.id,
      metorialProviderIds: [providerB]
    });
    expect(filtered.items.map(item => item.sessionKey)).toEqual([session.sessionKey]);

    let none = await agentTracking().session.list({
      organizationId: organization.id,
      metorialProviderIds: [uniqueId('pro')]
    });
    expect(none.items).toEqual([]);
  });

  it('links a redacted MCP call sent with default settings', async () => {
    let { organization, instance, secret } = await createHookToken();
    let sessionId = uniqueId('session');
    let toolCallId = uniqueId('toolu');
    let providerId = uniqueId('pro');

    await sendToolCall({ secret, sessionId, toolCallId });
    await agentTracking().toolCallLink.upsert({
      organizationId: organization.id,
      instanceId: instance.id,
      links: [link(toolCallId, { toolCallId: uniqueId('tcal'), providerId })]
    });

    let session = await sessionWithProviders({
      organizationId: organization.id,
      instanceId: instance.id,
      providerIds: [providerId]
    });

    let calls = await agentTracking().session.listMcpToolCalls({
      organizationId: organization.id,
      sessionKey: session.sessionKey
    });

    expect(calls.items.map(item => item.toolCallId)).toEqual([toolCallId]);
    expect(calls.items[0]!.mcpTool ?? null).toBeNull();
    expect(JSON.stringify(calls)).not.toMatch(/linear|create_issue/);
  });

  it('links nothing for a pair two Metorial tool calls claim', async () => {
    let { organization, instance, secret } = await createToolDetailsHookToken();
    let sessionId = uniqueId('session');
    let toolCallId = uniqueId('toolu');
    let providerId = uniqueId('pro');

    await sendToolCall({ secret, sessionId, toolCallId });
    await agentTracking().toolCallLink.upsert({
      organizationId: organization.id,
      instanceId: instance.id,
      links: [
        link(toolCallId, { toolCallId: uniqueId('tcal'), providerId }),
        link(toolCallId, { toolCallId: uniqueId('tcal'), providerId })
      ]
    });
    await sendToolCall({ secret, sessionId, toolCallId: uniqueId('toolu') });

    await eventually(
      async () => {
        let { items } = await agentTracking().session.list({
          organizationId: organization.id,
          instanceIds: [instance.id]
        });
        expect(items[0]!.summary?.toolCalls).toBe(2);
        expect(items[0]!.summary?.metorial.providerIds).toEqual([]);
      },
      { timeoutMs: 30_000 }
    );
  });

  it('links nothing for a pair two agent sessions share', async () => {
    let { organization, instance, secret } = await createToolDetailsHookToken();
    let toolCallId = uniqueId('toolu');

    await sendToolCall({ secret, sessionId: uniqueId('session'), toolCallId });
    await sendToolCall({ secret, sessionId: uniqueId('session'), toolCallId });
    await agentTracking().toolCallLink.upsert({
      organizationId: organization.id,
      instanceId: instance.id,
      links: [link(toolCallId, { toolCallId: uniqueId('tcal'), providerId: uniqueId('pro') })]
    });

    await eventually(
      async () => {
        let { items } = await agentTracking().session.list({
          organizationId: organization.id,
          instanceIds: [instance.id]
        });
        expect(items).toHaveLength(2);
        for (let item of items) expect(item.summary?.metorial.providerIds).toEqual([]);
      },
      { timeoutMs: 30_000 }
    );
  });

  it('keeps the provider but no tool key for a link sent without one', async () => {
    let { organization, instance, secret } = await createToolDetailsHookToken();
    let toolCallId = uniqueId('toolu');
    let providerId = uniqueId('pro');

    await sendToolCall({ secret, sessionId: uniqueId('session'), toolCallId });
    await agentTracking().toolCallLink.upsert({
      organizationId: organization.id,
      instanceId: instance.id,
      links: [
        {
          clientFamily: 'claude-code',
          toolCallId,
          calledAt: new Date(),
          metorial: { toolCallId: uniqueId('tcal'), providerId }
        }
      ]
    });

    let session = await sessionWithProviders({
      organizationId: organization.id,
      instanceId: instance.id,
      providerIds: [providerId]
    });
    expect(session.summary?.metorial.toolKeys).toEqual([]);
  });

  it("does not take another instance's links", async () => {
    let first = await createToolDetailsHookToken();
    let second = await createToolDetailsHookToken();
    let sessionId = uniqueId('session');
    let toolCallId = uniqueId('toolu');

    await agentTracking().toolCallLink.upsert({
      organizationId: second.organization.id,
      instanceId: second.instance.id,
      links: [link(toolCallId, { toolCallId: uniqueId('tcal'), providerId: uniqueId('pro') })]
    });
    await sendToolCall({ secret: first.secret, sessionId, toolCallId });

    await eventually(
      async () => {
        let { items } = await agentTracking().session.list({
          organizationId: first.organization.id,
          instanceIds: [first.instance.id]
        });
        expect(items[0]!.summary?.toolCalls).toBe(1);
        expect(items[0]!.summary?.metorial.providerIds).toEqual([]);
      },
      { timeoutMs: 30_000 }
    );
  });

  it('refuses more than 200 links at once', async () => {
    let { organization, instance } = await createToolDetailsHookToken();

    await expect(
      agentTracking().toolCallLink.upsert({
        organizationId: organization.id,
        instanceId: instance.id,
        links: Array.from({ length: 201 }, () =>
          link(uniqueId('toolu'), { toolCallId: uniqueId('tcal'), providerId: 'pro_1' })
        )
      })
    ).rejects.toMatchObject({ data: { status: 400 } });
  });
});
