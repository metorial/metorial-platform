import {
  connectSession,
  createProviderSession,
  createRemoteProvider,
  eventually,
  expectAuthMatrix,
  expectError,
  expectOk,
  expectPresented,
  findTool,
  listAll,
  uniqueId,
  useMcpTestServer,
  useOrganization
} from '@metorial/e2e';
import { beforeAll, describe, expect, it } from 'vitest';
import { crossTenantClients, ids, instancePathFor } from './_shared';

describe('api-core sessions: session activity after MCP traffic', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let server = useMcpTestServer();

  let session: any;
  let idleSession: any;

  beforeAll(async () => {
    let { providerId } = await createRemoteProvider(org.clients.instance, { url: server.url });
    session = await createProviderSession(org.clients.instance, [providerId], {
      name: uniqueId('e2e-activity')
    });
    idleSession = await createProviderSession(org.clients.instance, [providerId]);

    let client = connectSession(session.id, org.keys.instanceSecret);
    let init = await client.initialize();
    if (init.status !== 200) throw new Error(`initialize responded ${init.status}`);

    let tools = await client.listTools();
    let add = findTool(tools.result.tools, 'add');
    let echo = findTool(tools.result.tools, 'echo');
    await client.request('tools/call', { name: add.name, arguments: { a: 2, b: 3 } });
    await client.request('tools/call', { name: echo.name, arguments: { text: 'hello' } });
  }, 180_000);

  let list = (path: string, query: Record<string, string | number | undefined> = {}) =>
    listAll(org.clients.instance, path, { query });

  it('records the connection of a session', async () => {
    let connections = await eventually(async () => {
      let items = await list('/session-connections', { session_id: session.id });
      expect(items.length).toBeGreaterThan(0);
      return items;
    });

    for (let connection of connections) {
      expectPresented(connection, 'session.connection');
      expect(connection.session_id).toBe(session.id);
    }

    let fetched = expectOk(
      await org.clients.instance.get(`/session-connections/${connections[0].id}`)
    );
    expect(fetched.id).toBe(connections[0].id);
    expect(fetched.mcp?.protocol_version).toEqual(expect.any(String));

    expect(await list('/session-connections', { session_id: idleSession.id })).toEqual([]);

    let byState = await list('/session-connections', {
      session_id: session.id,
      connection_state: fetched.connection_state
    });
    expect(ids(byState)).toContain(fetched.id);

    expectError(
      await org.clients.instance.get('/session-connections', {
        query: { connection_state: 'unknown' }
      }),
      400,
      'invalid_data'
    );
    expectError(
      await org.clients.instance.get(`/session-connections/${uniqueId('sco')}`),
      404,
      'not_found'
    );
  });

  it('records the messages of a session', async () => {
    let messages = await eventually(async () => {
      let items = await list('/session-messages', { session_id: session.id });
      let toolCalls = items.filter(item =>
        JSON.stringify(item.input ?? {}).includes('tools/call')
      );
      expect(toolCalls.length).toBeGreaterThanOrEqual(2);
      return items;
    });

    for (let message of messages) {
      expectPresented(message, 'session.message');
      expect(message.session_id).toBe(session.id);
    }

    let paged = await listAll(org.clients.instance, '/session-messages', {
      query: { session_id: session.id },
      limit: 1
    });
    expect(ids(paged).sort()).toEqual(ids(messages).sort());

    let fetched = expectOk(
      await org.clients.instance.get(`/session-messages/${messages[0].id}`)
    );
    expect(fetched.id).toBe(messages[0].id);

    let clientMessages = await list('/session-messages', {
      session_id: session.id,
      source: 'client'
    });
    for (let message of clientMessages) expect(message.source).toBe('client');

    let byConnection = await list('/session-messages', {
      session_id: session.id,
      session_connection_id: messages[0].connection_id ?? undefined
    });
    expect(byConnection.length).toBeGreaterThan(0);

    for (let query of [{ type: 'bogus' }, { source: 'server' }, { hierarchy: 'sibling' }]) {
      expectError(
        await org.clients.instance.get('/session-messages', { query }),
        400,
        'invalid_data'
      );
    }
    expectError(
      await org.clients.instance.get(`/session-messages/${uniqueId('smsg')}`),
      404,
      'not_found'
    );
  });

  it('records the events of a session', async () => {
    let events = await eventually(async () => {
      let items = await list('/session-events', { session_id: session.id });
      expect(items.length).toBeGreaterThan(0);
      return items;
    });

    for (let event of events) {
      expectPresented(event, 'session.event');
    }

    let fetched = expectOk(await org.clients.instance.get(`/session-events/${events[0].id}`));
    expect(fetched.id).toBe(events[0].id);

    let byType = await list('/session-events', {
      session_id: session.id,
      type: fetched.type
    });
    expect(ids(byType)).toContain(fetched.id);

    expectError(
      await org.clients.instance.get(`/session-events/${uniqueId('sev')}`),
      404,
      'not_found'
    );
  });

  it('updates session usage and connection state', async () => {
    let fetched = await eventually(async () => {
      let body = expectOk(await org.clients.instance.get(`/sessions/${session.id}`));
      expect(body.usage.total_productive_client_message_count).toBeGreaterThan(0);
      return body;
    });
    expect(fetched.has_errors).toBe(false);

    let idle = expectOk(await org.clients.instance.get(`/sessions/${idleSession.id}`));
    expect(idle.usage.total_productive_client_message_count).toBe(0);
    expect(idle.connection_state).toBe('disconnected');
  });

  it('lists tool calls, provider runs, participants and errors of a session', async () => {
    let runs = await eventually(async () => {
      let items = await list('/provider-runs', { session_id: session.id });
      expect(items.length).toBeGreaterThan(0);
      return items;
    });
    for (let run of runs) expectPresented(run, 'session.provider_run');
    expect(expectOk(await org.clients.instance.get(`/provider-runs/${runs[0].id}`)).id).toBe(
      runs[0].id
    );

    let participants = await list('/session-participants', { session_id: session.id });
    for (let participant of participants) {
      expectPresented(participant, 'session.participant');
    }

    let toolCalls = await list('/tool-calls', { session_id: session.id });
    for (let toolCall of toolCalls) expectPresented(toolCall, 'session.tool_call');

    let errors = await list('/session-errors', { session_id: session.id });
    expect(errors).toEqual([]);
    expectError(
      await org.clients.instance.get('/session-errors', { query: { type: 'unknown' } }),
      400,
      'invalid_data'
    );
    expectError(
      await org.clients.instance.get(`/session-errors/${uniqueId('serr')}`),
      404,
      'not_found'
    );

    let errorGroups = expectOk(await org.clients.instance.get('/session-error-groups'));
    expect(Array.isArray(errorGroups.items)).toBe(true);
  });

  it('authenticates activity routes per credential', async () => {
    let connection = (await list('/session-connections', { session_id: session.id }))[0];
    let message = (await list('/session-messages', { session_id: session.id }))[0];
    let clients = crossTenantClients(org, otherOrg);
    let expected = {
      none: 401,
      session: 200,
      management: 200,
      instance: 200,
      otherSession: 404,
      otherManagement: 404,
      otherInstance: 404
    } as const;

    await expectAuthMatrix(
      clients,
      (client, name) =>
        client.get(instancePathFor(org, name, `/session-connections/${connection.id}`)),
      expected
    );
    await expectAuthMatrix(
      clients,
      (client, name) =>
        client.get(instancePathFor(org, name, `/session-messages/${message.id}`)),
      expected
    );

    let lists = await expectAuthMatrix(
      clients,
      (client, name) =>
        client.get(instancePathFor(org, name, '/session-events'), {
          query: { session_id: session.id }
        }),
      { none: 401, session: 200, management: 200, instance: 200, otherInstance: 200 }
    );
    expect(lists.instance.body.items.length).toBeGreaterThan(0);
    expect(lists.otherInstance.body.items).toEqual([]);
  });

  it('hides session activity from other organizations', async () => {
    let other = otherOrg.clients.instance;
    let connection = (await list('/session-connections', { session_id: session.id }))[0];
    let message = (await list('/session-messages', { session_id: session.id }))[0];
    let event = (await list('/session-events', { session_id: session.id }))[0];
    let run = (await list('/provider-runs', { session_id: session.id }))[0];

    expectError(await other.get(`/session-connections/${connection.id}`), 404, 'not_found');
    expectError(await other.get(`/session-messages/${message.id}`), 404, 'not_found');
    expectError(await other.get(`/session-events/${event.id}`), 404, 'not_found');
    expectError(await other.get(`/provider-runs/${run.id}`), 404, 'not_found');

    for (let path of [
      '/session-connections',
      '/session-messages',
      '/session-events',
      '/provider-runs',
      '/tool-calls',
      '/session-participants'
    ]) {
      expect(await listAll(other, path, { query: { session_id: session.id } })).toEqual([]);
    }
  });
});
