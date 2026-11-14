import {
  connectSession,
  createProviderSession,
  createRemoteProvider,
  eventually,
  expectOk,
  expectPresented,
  findTool,
  useMcpTestServer,
  useOrganization
} from '@metorial/e2e';
import { beforeAll, describe, expect, it } from 'vitest';
import { listForSession } from './_connection';

describe('api-connection: session activity after MCP traffic', () => {
  let org = useOrganization();
  let server = useMcpTestServer();

  let providerId: string;

  beforeAll(async () => {
    ({ providerId } = await createRemoteProvider(org.clients.instance, { url: server.url }));
  }, 120_000);

  let getSession = async (sessionId: string) =>
    expectOk(await org.clients.instance.get(`/sessions/${sessionId}`));

  it('records the connection, its events and its messages', async () => {
    let session = await createProviderSession(org.clients.instance, [providerId]);
    expect(session.connection_state).toBe('disconnected');
    expect(
      await listForSession(org.clients.instance, '/session-connections', session.id)
    ).toEqual([]);

    let client = connectSession(session.id, org.keys.instanceSecret);
    expect((await client.initialize()).status).toBe(200);
    let tools = await client.listTools();
    let add = findTool(tools.result.tools, 'add');
    let call = await client.request('tools/call', {
      name: add.name,
      arguments: { a: 2, b: 3 }
    });
    expect(call.result.content).toEqual([{ type: 'text', text: '5' }]);

    let token = client.sessionId!;

    let connections = await listForSession(
      org.clients.instance,
      '/session-connections',
      session.id
    );
    expect(connections).toHaveLength(1);
    let [connection] = connections;
    expectPresented(connection, 'session.connection');
    expect(connection).toMatchObject({
      session_id: session.id,
      connection_state: 'connected',
      transport: 'mcp',
      mcp: { protocol_version: '2025-03-26', transport: 'streamable_http' }
    });
    expect(connection.participant).not.toBeNull();
    expect(JSON.stringify(connection)).not.toContain(token);

    let fetched = expectOk(
      await org.clients.instance.get(`/session-connections/${connection.id}`)
    );
    expect(fetched.id).toBe(connection.id);

    await eventually(async () => {
      let current = await getSession(session.id);
      expect(current.connection_state).toBe('connected');
      expect(current.usage.total_productive_client_message_count).toBeGreaterThan(0);
    });

    let events = await eventually(async () => {
      let events = await listForSession(org.clients.instance, '/session-events', session.id);
      expect(events.map(event => event.type)).toEqual(
        expect.arrayContaining([
          'session_created',
          'connection_created',
          'connection_connected',
          'message_created'
        ])
      );
      return events;
    });
    for (let event of events) expectPresented(event, 'session.event');
    expect(events.find(event => event.type === 'connection_created')?.connection?.id).toBe(
      connection.id
    );

    let toolMessage = await eventually(async () => {
      let messages = await listForSession(
        org.clients.instance,
        '/session-messages',
        session.id
      );
      let message = messages.find(item => item.input?.method === 'tools/call');
      expect(message).toBeDefined();
      expect(message.status).toBe('succeeded');
      return message;
    });
    expectPresented(toolMessage, 'session.message');
    expect(toolMessage).toMatchObject({
      session_id: session.id,
      connection_id: connection.id,
      source: 'client',
      input: { params: { name: add.name, arguments: { a: 2, b: 3 } } },
      output: { result: { content: [{ type: 'text', text: '5' }] } }
    });
    expect(toolMessage.transport.type).toBe('mcp');
    expect(toolMessage.transport.mcp.transport).toBe('streamable_http');

    let toolCalls = await listForSession(org.clients.instance, '/tool-calls', session.id);
    expect(toolCalls).toHaveLength(1);
    expectPresented(toolCalls[0], 'session.tool_call');
    expect(toolCalls[0]).toMatchObject({
      session_id: session.id,
      message_id: toolMessage.id,
      connection_id: connection.id,
      status: 'succeeded'
    });
  }, 120_000);

  it('records failed tool calls as session errors', async () => {
    let session = await createProviderSession(org.clients.instance, [providerId]);
    expect(session.has_errors).toBe(false);

    let client = connectSession(session.id, org.keys.instanceSecret);
    await client.initialize();
    let tools = await client.listTools();
    let missing = findTool(tools.result.tools, 'add').name.replace(/add$/, 'missing');

    let call = await client.request('tools/call', { name: missing, arguments: {} });
    expect(call.error?.code).toBe(-32000);

    await eventually(async () => {
      let errors = await listForSession(org.clients.instance, '/session-errors', session.id);
      expect(errors.length).toBeGreaterThan(0);
      expectPresented(errors[0]);
      expect(errors[0].session_id).toBe(session.id);

      expect((await getSession(session.id)).has_errors).toBe(true);
    });
  }, 120_000);

  it('keeps sessions of one instance apart', async () => {
    let first = await createProviderSession(org.clients.instance, [providerId]);
    let second = await createProviderSession(org.clients.instance, [providerId]);

    let client = connectSession(first.id, org.keys.instanceSecret);
    await client.initialize();

    expect(
      await listForSession(org.clients.instance, '/session-connections', first.id)
    ).toHaveLength(1);
    expect(
      await listForSession(org.clients.instance, '/session-connections', second.id)
    ).toEqual([]);
    expect((await getSession(second.id)).connection_state).toBe('disconnected');
  }, 120_000);
});
