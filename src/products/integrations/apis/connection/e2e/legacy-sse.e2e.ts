import {
  createProviderSession,
  createRemoteProvider,
  findTool,
  useMcpTestServer,
  useOrganization
} from '@metorial/e2e';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  bearer,
  connectionUrl,
  initializeMessage,
  listForSession,
  openEventStream,
  rawMcp
} from './_connection';

describe('api-connection: legacy SSE transport', () => {
  let org = useOrganization();
  let server = useMcpTestServer();

  let providerId: string;

  beforeAll(async () => {
    ({ providerId } = await createRemoteProvider(org.clients.instance, { url: server.url }));
  }, 120_000);

  it('announces a message endpoint and streams responses to posted messages', async () => {
    let session = await createProviderSession(org.clients.instance, [providerId]);
    let stream = await openEventStream(
      connectionUrl(session.id),
      bearer(org.keys.instanceSecret)
    );

    try {
      expect(stream.status).toBe(200);
      expect(stream.headers.get('content-type')).toContain('text/event-stream');
      expect(stream.headers.get('metorial-session-id')).toBe(session.id);

      let endpointEvent = await stream.waitFor(event => event.event === 'endpoint');
      let endpoint = new URL(endpointEvent.data);
      let connectionToken = endpoint.searchParams.get('connection_token');
      expect(endpoint.pathname).toBe(`/connect/mcp/${session.id}`);
      expect(connectionToken).toBeTruthy();

      let messageUrl = `${connectionUrl(session.id)}?connection_token=${connectionToken}`;
      let post = (body: unknown) =>
        rawMcp(messageUrl, {
          headers: { ...bearer(org.keys.instanceSecret), accept: 'application/json' },
          body
        });

      let initPost = await post(initializeMessage(1));
      expect(initPost.status).toBeGreaterThanOrEqual(200);
      expect(initPost.status).toBeLessThan(300);

      let init = await stream.waitForMessage(1);
      expect(init.result.capabilities).toHaveProperty('tools');

      await post({ jsonrpc: '2.0', method: 'notifications/initialized' });

      await post({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
      let tools = await stream.waitForMessage(2);
      let add = findTool(tools.result.tools, 'add');

      await post({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: add.name, arguments: { a: 20, b: 22 } }
      });
      let call = await stream.waitForMessage(3);
      expect(call.result.content).toEqual([{ type: 'text', text: '42' }]);
      expect(server.toolCalls()).toContainEqual({ name: 'add', arguments: { a: 20, b: 22 } });

      let [connection] = await listForSession(
        org.clients.instance,
        '/session-connections',
        session.id
      );
      expect(connection.connection_state).toBe('connected');
      expect(connection.mcp).toMatchObject({
        protocol_version: '2025-03-26',
        transport: 'sse'
      });
    } finally {
      await stream.close();
    }
  }, 120_000);

  it('rejects an unknown connection token on the message endpoint', async () => {
    let session = await createProviderSession(org.clients.instance, [providerId]);

    let response = await rawMcp(`${connectionUrl(session.id)}?connection_token=unknown`, {
      headers: bearer(org.keys.instanceSecret),
      body: { jsonrpc: '2.0', id: 1, method: 'tools/list' }
    });
    expect(response.status).toBe(404);
    expect(JSON.parse(response.text)).toMatchObject({ object: 'error', code: 'not_found' });

    expect(
      await listForSession(org.clients.instance, '/session-connections', session.id)
    ).toEqual([]);
  });
});
