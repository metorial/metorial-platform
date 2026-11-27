import {
  type BootstrappedOrganization,
  connectSession,
  createProviderSession,
  createRemoteProvider,
  eventually,
  findTool,
  firstPage,
  uniqueId,
  useFixture,
  useMcpTestServer,
  useOrganization
} from '@metorial/e2e';
import { loadOrganizationFixture, subspaceDb } from '@metorial/e2e/db';
import { toolCallService } from '@metorial-subspace/module-session';
import { describe, expect, it } from 'vitest';
import { createManager } from './_fixtures';

let codexTurnMetadata = {
  session_id: 'codex-session',
  turn_id: 'codex-turn',
  workspaces: {
    '/home/e2e/project': {
      associated_remote_urls: ['git@example.com:org/repo.git'],
      latest_git_commit_hash: 'abc123',
      has_changes: false
    }
  }
};

let openSession = async (
  org: BootstrappedOrganization,
  providerId: string,
  clientName: string
) => {
  let session = await createProviderSession(org.clients.instance, [providerId]);
  let client = connectSession(session.id, org.keys.instanceSecret);

  let init = await client.request('initialize', {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: clientName, version: '1.0.0' }
  });
  expect(init.status).toBe(200);
  await client.notify('notifications/initialized');

  let listed = await client.listTools();
  let tools = listed.result.tools as { name: string; title?: string }[];

  return { session, client, add: findTool(tools, 'add') };
};

let waitForToolCall = (sessionId: string) =>
  eventually(
    async () =>
      await subspaceDb.toolCall.findFirstOrThrow({
        where: { session: { id: sessionId } },
        orderBy: { oid: 'desc' },
        include: { message: true }
      }),
    { timeoutMs: 60_000, intervalMs: 500 }
  );

describe('module-connection client call ids', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let server = useMcpTestServer();
  let remote = useFixture(() =>
    createRemoteProvider(org.clients.instance, { url: server.url })
  );

  it('stores the Claude Code tool use id on the tool call', async () => {
    let { session, client, add } = await openSession(org, remote.providerId, 'claude-code');
    let toolUseId = uniqueId('toolu');

    let call = await client.request('tools/call', {
      name: add.name,
      arguments: { a: 1, b: 2 },
      _meta: { 'claudecode/toolUseId': toolUseId, progressToken: 1 }
    });
    expect(call.result.content).toEqual([{ type: 'text', text: '3' }]);

    let toolCall = await waitForToolCall(session.id);
    expect(toolCall).toMatchObject({
      clientCallId: toolUseId,
      clientCallSource: 'claude-code'
    });
  }, 180_000);

  it('stores the Codex call id and never stores or forwards the turn metadata', async () => {
    let { session, client, add } = await openSession(org, remote.providerId, 'some-client');
    let callId = uniqueId('call');

    let call = await client.request('tools/call', {
      name: add.name,
      arguments: { a: 2, b: 2 },
      _meta: {
        callId,
        threadId: 'codex-thread',
        'x-codex-turn-metadata': codexTurnMetadata
      }
    });
    expect(call.result.content).toEqual([{ type: 'text', text: '4' }]);

    let toolCall = await waitForToolCall(session.id);
    expect(toolCall).toMatchObject({ clientCallId: callId, clientCallSource: 'codex' });
    expect(JSON.stringify(toolCall.message.input)).not.toContain('x-codex-turn-metadata');

    let forwarded = server.requests.filter(
      request => request.method === 'tools/call' && request.params?._meta?.callId === callId
    );
    expect(forwarded).toHaveLength(1);
    expect(forwarded[0]!.params._meta).not.toHaveProperty('x-codex-turn-metadata');
    expect(forwarded[0]!.params._meta).toMatchObject({ threadId: 'codex-thread' });
  }, 180_000);

  it('stores the Codex call id when the connection was initialized by Codex', async () => {
    let { session, client, add } = await openSession(
      org,
      remote.providerId,
      'codex-mcp-client'
    );
    let callId = uniqueId('exec');

    await client.request('tools/call', {
      name: add.name,
      arguments: { a: 3, b: 3 },
      _meta: { callId }
    });

    let toolCall = await waitForToolCall(session.id);
    expect(toolCall).toMatchObject({ clientCallId: callId, clientCallSource: 'codex' });
  }, 180_000);

  it('ignores a bare call id and invalid ids from other clients', async () => {
    let { session, client, add } = await openSession(org, remote.providerId, 'claude-code');

    let call = await client.request('tools/call', {
      name: add.name,
      arguments: { a: 4, b: 4 },
      _meta: { callId: uniqueId('call'), 'claudecode/toolUseId': 'x'.repeat(300) }
    });
    expect(call.result.content).toEqual([{ type: 'text', text: '8' }]);

    let toolCall = await waitForToolCall(session.id);
    expect(toolCall).toMatchObject({ clientCallId: null, clientCallSource: null });
  }, 180_000);

  it('leaves the client call empty on in-process tool calls', async () => {
    let session = await createProviderSession(org.clients.instance, [remote.providerId]);
    let manager = await createManager(org, { sessionId: session.id });
    await manager.initialize({
      client: { identifier: uniqueId('e2e-client'), name: 'E2E client' },
      mcpTransport: 'none'
    });

    let { tools } = await manager.listTools();
    let add = tools.find(tool => tool.key.endsWith('_tool_add'))!;

    await manager.callTool({
      toolId: add.key,
      input: { type: 'tool.call', data: { a: 5, b: 5 } },
      waitForResponse: true,
      transport: 'tool_call'
    });

    let toolCall = await waitForToolCall(session.id);
    expect(toolCall).toMatchObject({ clientCallId: null, clientCallSource: null });
  }, 180_000);

  it('looks up tool calls by client call id within the instance only', async () => {
    let { session, client, add } = await openSession(org, remote.providerId, 'claude-code');
    let toolUseId = uniqueId('toolu');

    await client.request('tools/call', {
      name: add.name,
      arguments: { a: 6, b: 6 },
      _meta: { 'claudecode/toolUseId': toolUseId }
    });
    let stored = await waitForToolCall(session.id);

    let fixture = await loadOrganizationFixture(org.ids);
    let otherFixture = await loadOrganizationFixture(otherOrg.ids);

    let found = await firstPage(
      await toolCallService.listToolCalls({
        instance: fixture.instance,
        clientCallIds: [toolUseId, uniqueId('toolu')],
        clientCallSource: 'claude-code'
      })
    );
    expect(found.map(item => item.id)).toEqual([stored.id]);

    let otherSource = await firstPage(
      await toolCallService.listToolCalls({
        instance: fixture.instance,
        clientCallIds: [toolUseId],
        clientCallSource: 'codex'
      })
    );
    expect(otherSource).toEqual([]);

    let otherInstance = await firstPage(
      await toolCallService.listToolCalls({
        instance: otherFixture.instance,
        clientCallIds: [toolUseId]
      })
    );
    expect(otherInstance).toEqual([]);

    let byId = await firstPage(
      await toolCallService.listToolCalls({ instance: fixture.instance, ids: [stored.id] })
    );
    expect(byId).toHaveLength(1);
    expect(byId[0]).toMatchObject({
      clientCallId: toolUseId,
      clientCallSource: 'claude-code'
    });

    let byIdOtherInstance = await firstPage(
      await toolCallService.listToolCalls({
        instance: otherFixture.instance,
        ids: [stored.id]
      })
    );
    expect(byIdOtherInstance).toEqual([]);

    let none = await firstPage(
      await toolCallService.listToolCalls({ instance: fixture.instance, clientCallIds: [] })
    );
    expect(none).toEqual([]);
  }, 180_000);
});
