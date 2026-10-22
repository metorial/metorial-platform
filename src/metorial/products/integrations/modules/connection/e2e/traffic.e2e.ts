import {
  createRemoteProvider,
  eventually,
  findTool,
  useFixture,
  useMcpTestServer,
  useOrganization
} from '@metorial/e2e';
import { subspaceDb } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import { connectionEventTypes, createManager, openMcpSession, scopeOf } from './_fixtures';

let waitForToolCallMessage = (connectionOid: bigint) =>
  eventually(
    async () => {
      let message = await subspaceDb.sessionMessage.findFirstOrThrow({
        where: { connectionOid, toolCall: { isNot: null } },
        orderBy: { oid: 'desc' },
        include: { toolCall: { include: { tool: true } } }
      });
      expect(message.finalizedAt).not.toBeNull();
      return message;
    },
    { timeoutMs: 60_000, intervalMs: 500 }
  );

describe('module-connection records of session traffic', () => {
  let org = useOrganization();
  let server = useMcpTestServer();
  let remote = useFixture(() =>
    createRemoteProvider(org.clients.instance, { url: server.url })
  );

  it('records an MCP connection, its discovered provider tools and a tool call', async () => {
    let { tenant } = await scopeOf(org);
    let { session, client, tools } = await openMcpSession(org, remote.providerId);
    let add = findTool(tools, 'add');

    let call = await client.request('tools/call', {
      name: add.name,
      arguments: { a: 2, b: 3 }
    });
    expect(call.result.content).toEqual([{ type: 'text', text: '5' }]);

    let sessionRow = await subspaceDb.session.findUniqueOrThrow({
      where: { id: session.id },
      include: { providers: true }
    });
    let sessionProvider = sessionRow.providers[0]!;

    let connection = await subspaceDb.sessionConnection.findUniqueOrThrow({
      where: { token: client.sessionId! }
    });
    expect(connection).toMatchObject({
      sessionOid: sessionRow.oid,
      tenantOid: tenant.oid,
      status: 'active',
      state: 'connected',
      initState: 'completed',
      transport: 'mcp',
      mcpTransport: 'streamable_http',
      mcpProtocolVersion: '2025-03-26',
      isManuallyDisabled: false
    });
    expect(connection.participantOid).not.toBeNull();
    expect(connection.expiresAt.getTime()).toBeGreaterThan(Date.now());

    let specification =
      await subspaceDb.sessionConnectionProviderSpecification.findUniqueOrThrow({
        where: {
          connectionOid_sessionProviderOid: {
            connectionOid: connection.oid,
            sessionProviderOid: sessionProvider.oid
          }
        },
        include: { specification: { include: { providerTools: true } } }
      });
    expect(specification.status).toBe('discovered');
    expect(specification.discoveredAt).toBeInstanceOf(Date);
    expect(specification.specification!.providerTools.map(tool => tool.key)).toEqual(
      expect.arrayContaining(['tool_add', 'tool_echo'])
    );

    let message = await waitForToolCallMessage(connection.oid);
    expect(message).toMatchObject({
      status: 'succeeded',
      source: 'client',
      transport: 'mcp',
      sessionOid: sessionRow.oid,
      sessionProviderOid: sessionProvider.oid,
      hasOutput: true,
      methodOrToolKey: expect.stringMatching(/_tool_add$/)
    });
    expect(message.toolCall).toMatchObject({
      sessionOid: sessionRow.oid,
      tenantOid: tenant.oid,
      toolKey: message.methodOrToolKey
    });
    expect(message.toolCall!.tool.key).toBe('tool_add');
    expect(message.toolCall!.providerRunOid).toBe(message.providerRunOid);
    expect(message.providerRunOid).not.toBeNull();
    expect(JSON.stringify(message.output)).toContain('5');

    await eventually(async () => {
      let counted = await subspaceDb.sessionConnection.findUniqueOrThrow({
        where: { oid: connection.oid }
      });
      expect(counted.totalProductiveClientMessageCount).toBeGreaterThanOrEqual(1);
      expect(counted.totalProductiveProviderMessageCount).toBeGreaterThanOrEqual(1);
      expect(counted.lastMessageAt).toBeInstanceOf(Date);

      expect(await connectionEventTypes(connection.oid)).toEqual(
        expect.arrayContaining(['connection_created', 'provider_run_started'])
      );
    });
  }, 180_000);

  it.fails(
    'stores a tool call made over MCP as an mcp_message (bug: createMessage hard-codes type tool_call and ignores the type its callers pass)',
    async () => {
      let { client, tools } = await openMcpSession(org, remote.providerId);
      await client.request('tools/call', {
        name: findTool(tools, 'echo').name,
        arguments: { text: 'typed' }
      });

      let connection = await subspaceDb.sessionConnection.findUniqueOrThrow({
        where: { token: client.sessionId! }
      });
      let message = await waitForToolCallMessage(connection.oid);

      expect(message.transport).toBe('mcp');
      expect(message.type).toBe('mcp_message');
    },
    180_000
  );

  it('records an in-process tool call with its provider run and usage record', async () => {
    let session = (await openMcpSession(org, remote.providerId)).session;

    let manager = await createManager(org, { sessionId: session.id });
    let connection = await manager.initialize({
      client: { identifier: 'e2e-in-process-client', name: 'E2E in-process client' },
      mcpTransport: 'none'
    });
    expect(connection).toMatchObject({
      transport: 'tool_call',
      mcpTransport: 'none',
      state: 'connected',
      initState: 'completed'
    });

    let { tools } = await manager.listTools();
    let add = tools.find(tool => tool.key.endsWith('_tool_add'))!;
    expect(add).toBeDefined();

    let result = await manager.callTool({
      toolId: add.key,
      input: { type: 'tool.call', data: { a: 4, b: 5 } },
      waitForResponse: true,
      transport: 'tool_call'
    });
    expect(result.message.status).toBe('succeeded');
    expect(JSON.stringify(result.message.output)).toContain('9');
    expect(server.toolCalls()).toContainEqual(
      expect.objectContaining({ name: 'add', arguments: { a: 4, b: 5 } })
    );

    let message = await waitForToolCallMessage(connection.oid);
    expect(message).toMatchObject({
      id: result.message.id,
      transport: 'tool_call',
      source: 'client',
      type: 'tool_call'
    });
    expect(message.toolCall!.tool.key).toBe('tool_add');

    let run = await eventually(async () => {
      let run = await subspaceDb.providerRun.findFirstOrThrow({
        where: { connectionOid: connection.oid }
      });
      expect(
        await subspaceDb.providerRunUsageRecord.count({ where: { providerRunOid: run.oid } })
      ).toBe(1);
      return run;
    });
    expect(run).toMatchObject({
      sessionOid: connection.sessionOid,
      tenantOid: connection.tenantOid
    });
    expect(message.providerRunOid).toBe(run.oid);

    await eventually(async () => {
      let counted = await subspaceDb.sessionConnection.findUniqueOrThrow({
        where: { oid: connection.oid }
      });
      expect(counted.totalProductiveClientMessageCount).toBe(1);
      expect(counted.totalProductiveProviderMessageCount).toBe(1);
    });
  }, 180_000);
});
