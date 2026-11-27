import { eventually, uniqueId } from '@lowerdeck/testing-tools';
import { describe, expect, it } from 'vitest';
import { agentTracking, createHookToken, createScope, ingest, rpcErrorCode } from './support';

type HookClient = 'claude-code' | 'codex';

let sendHook = async (d: {
  secret: string;
  client?: HookClient;
  sessionId: string;
  event: string;
  extra?: Record<string, unknown>;
}) => {
  let response = await ingest(`/v1/ingest/hooks/${d.client ?? 'claude-code'}`, {
    credential: d.secret,
    body: JSON.stringify({ session_id: d.sessionId, hook_event_name: d.event, ...d.extra })
  });

  expect(response.status).toBe(200);
};

let sendToolCall = (d: {
  secret: string;
  client?: HookClient;
  sessionId: string;
  toolCallId: string;
  toolName: string;
  event?: string;
}) =>
  sendHook({
    secret: d.secret,
    client: d.client,
    sessionId: d.sessionId,
    event: d.event ?? 'PostToolUse',
    extra: { tool_use_id: d.toolCallId, tool_name: d.toolName, duration_ms: 250 }
  });

let sessionOf = async (organizationId: string, instanceId: string) =>
  await eventually(
    async () => {
      let { items } = await agentTracking().session.list({
        organizationId,
        instanceIds: [instanceId]
      });
      expect(items).toHaveLength(1);

      return items[0]!;
    },
    { timeoutMs: 30_000 }
  );

describe('session tool calls', () => {
  it("lists a session's MCP tool calls once per call, oldest first", async () => {
    let { organization, instance, secret } = await createHookToken();
    let sessionId = uniqueId('session');
    let first = uniqueId('toolu');
    let second = uniqueId('toolu');

    await sendHook({ secret, sessionId, event: 'UserPromptSubmit', extra: { prompt: 'hi' } });
    await sendToolCall({
      secret,
      sessionId,
      toolCallId: first,
      toolName: 'mcp__linear__create_issue',
      event: 'PermissionRequest'
    });
    await sendToolCall({
      secret,
      sessionId,
      toolCallId: first,
      toolName: 'mcp__linear__create_issue'
    });
    await sendToolCall({ secret, sessionId, toolCallId: uniqueId('toolu'), toolName: 'Bash' });
    await sendToolCall({
      secret,
      sessionId,
      toolCallId: second,
      toolName: 'mcp__github__get_issue'
    });

    let session = await sessionOf(organization.id, instance.id);

    let result = await agentTracking().session.listMcpToolCalls({
      organizationId: organization.id,
      sessionKey: session.sessionKey
    });

    expect(result).toMatchObject({
      object: 'list',
      sessionKey: session.sessionKey,
      instanceId: instance.id,
      hasMore: false
    });
    expect(result.items.map(item => item.toolCallId)).toEqual([first, second]);
    expect(result.items[0]).toMatchObject({
      object: 'agent_tracking#session_tool_call',
      clientFamily: 'claude-code',
      durationMs: 250,
      outcome: 'ok',
      mcpServer: 'linear',
      mcpTool: 'create_issue'
    });
  });

  it('finds the sessions of tool-call ids within one instance and client family', async () => {
    let { organization, instance, secret } = await createHookToken();
    let sessionId = uniqueId('session');
    let shared = uniqueId('call');

    await sendToolCall({
      secret,
      sessionId,
      toolCallId: shared,
      toolName: 'mcp__linear__create_issue'
    });
    await sendToolCall({
      secret,
      client: 'codex',
      sessionId: uniqueId('session'),
      toolCallId: shared,
      toolName: 'mcp__linear__create_issue'
    });

    let found = await eventually(
      async () => {
        let result = await agentTracking().session.findByToolCalls({
          organizationId: organization.id,
          instanceId: instance.id,
          toolCalls: [
            { clientFamily: 'claude-code', toolCallId: shared },
            { clientFamily: 'claude-code', toolCallId: shared },
            { clientFamily: 'claude-code', toolCallId: uniqueId('unknown') }
          ]
        });
        expect(result.items).toHaveLength(1);

        return result;
      },
      { timeoutMs: 30_000 }
    );

    expect(found.items[0]).toMatchObject({
      object: 'agent_tracking#tool_call_session',
      clientFamily: 'claude-code',
      toolCallId: shared
    });
    expect(found.sessions.map(session => session.sessionKey)).toEqual([
      found.items[0]!.sessionKey
    ]);
    expect(found.sessions[0]).toMatchObject({
      object: 'agent_tracking#session',
      instanceId: instance.id,
      client: { family: 'claude-code' }
    });

    let codex = await agentTracking().session.findByToolCalls({
      organizationId: organization.id,
      instanceId: instance.id,
      toolCalls: [{ clientFamily: 'codex', toolCallId: shared }]
    });

    expect(codex.items).toHaveLength(1);
    expect(codex.items[0]!.sessionKey).not.toBe(found.items[0]!.sessionKey);
  });

  it('keeps tool calls inside their organization and instance', async () => {
    let { organization, project, instance, secret } = await createHookToken();
    let other = await createScope();
    let sibling = await agentTracking().instance.upsert({
      organizationId: organization.id,
      projectId: project.id,
      ref: uniqueId('inst')
    });
    let toolCallId = uniqueId('toolu');

    await sendToolCall({
      secret,
      sessionId: uniqueId('session'),
      toolCallId,
      toolName: 'mcp__linear__create_issue'
    });

    let session = await sessionOf(organization.id, instance.id);

    expect(
      await rpcErrorCode(
        agentTracking().session.listMcpToolCalls({
          organizationId: other.organization.id,
          sessionKey: session.sessionKey
        })
      )
    ).toBe('not_found');

    expect(
      await rpcErrorCode(
        agentTracking().session.findByToolCalls({
          organizationId: other.organization.id,
          instanceId: instance.id,
          toolCalls: [{ clientFamily: 'claude-code', toolCallId }]
        })
      )
    ).toBe('not_found');

    let elsewhere = await agentTracking().session.findByToolCalls({
      organizationId: organization.id,
      instanceId: sibling.id,
      toolCalls: [{ clientFamily: 'claude-code', toolCallId }]
    });
    expect(elsewhere).toEqual({ object: 'list', items: [], ambiguous: [], sessions: [] });
  });

  it('links nothing for an id reused in two sessions and flags it', async () => {
    let { organization, instance, secret } = await createHookToken();
    let reused = uniqueId('call');
    let long = `${uniqueId('toolu')}${'x'.repeat(300)}`;

    for (let sessionId of [uniqueId('session'), uniqueId('session')]) {
      await sendToolCall({
        secret,
        sessionId,
        toolCallId: reused,
        toolName: 'mcp__linear__get'
      });
    }
    await sendToolCall({
      secret,
      sessionId: uniqueId('session'),
      toolCallId: long,
      toolName: 'mcp__linear__get'
    });

    let result = await eventually(
      async () => {
        let found = await agentTracking().session.findByToolCalls({
          organizationId: organization.id,
          instanceId: instance.id,
          toolCalls: [
            { clientFamily: 'claude-code', toolCallId: reused },
            { clientFamily: 'claude-code', toolCallId: long }
          ]
        });
        expect(found.ambiguous).toHaveLength(1);
        expect(found.items).toHaveLength(1);

        return found;
      },
      { timeoutMs: 30_000 }
    );

    expect(result.ambiguous).toEqual([{ clientFamily: 'claude-code', toolCallId: reused }]);
    expect(result.items[0]).toMatchObject({ toolCallId: long });
  });

  it('bounds the lookup to 200 tool calls', async () => {
    let { organization, instance } = await createScope();

    expect(
      await rpcErrorCode(
        agentTracking().session.findByToolCalls({
          organizationId: organization.id,
          instanceId: instance.id,
          toolCalls: Array.from({ length: 201 }, (_, index) => ({
            clientFamily: 'claude-code',
            toolCallId: `toolu_${index}`
          }))
        })
      )
    ).toBe('invalid_data');
  });
});
