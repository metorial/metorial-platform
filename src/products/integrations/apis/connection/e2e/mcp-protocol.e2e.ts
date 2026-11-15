import {
  createProviderSession,
  createRemoteProvider,
  eventually,
  expectError,
  findTool,
  uniqueId,
  useMcpTestServer,
  useOrganization
} from '@metorial/e2e';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  bearer,
  connectionUrl,
  initializeMessage,
  listForSession,
  rawMcp
} from './_connection';

let alphaTools = [
  {
    name: 'reverse',
    description: 'Reverses the given text',
    inputSchema: {
      type: 'object',
      properties: { text: { type: 'string' } },
      required: ['text']
    },
    handler: (args: Record<string, any>) => String(args.text).split('').reverse().join('')
  },
  {
    name: 'explode',
    description: 'Always fails',
    handler: () => {
      throw new Error('upstream exploded');
    }
  }
];

let betaTools = [
  {
    name: 'multiply',
    description: 'Multiplies two numbers',
    inputSchema: {
      type: 'object',
      properties: { a: { type: 'number' }, b: { type: 'number' } },
      required: ['a', 'b']
    },
    handler: (args: Record<string, any>) => String(Number(args.a) * Number(args.b))
  }
];

describe('api-connection: MCP protocol through the proxy', () => {
  let org = useOrganization();
  let alpha = useMcpTestServer({ tools: alphaTools, serverName: 'alpha' });
  let beta = useMcpTestServer({ tools: betaTools, serverName: 'beta' });

  let alphaProviderId: string;
  let betaProviderId: string;

  beforeAll(async () => {
    ({ providerId: alphaProviderId } = await createRemoteProvider(org.clients.instance, {
      url: alpha.url,
      name: uniqueId('alpha')
    }));
    ({ providerId: betaProviderId } = await createRemoteProvider(org.clients.instance, {
      url: beta.url,
      name: uniqueId('beta')
    }));
  }, 180_000);

  let nextId = 100;

  let connect = async (providerIds = [alphaProviderId, betaProviderId]) => {
    let session = await createProviderSession(org.clients.instance, providerIds);
    let url = connectionUrl(session.id);

    let init = await rawMcp(url, {
      headers: bearer(org.keys.instanceSecret),
      body: initializeMessage()
    });
    expect(init.status).toBe(200);

    let token = init.headers.get('mcp-session-id')!;
    expect(token).toBeTruthy();

    let headers = { ...bearer(org.keys.instanceSecret), 'mcp-session-id': token };
    await rawMcp(url, {
      headers,
      body: { jsonrpc: '2.0', method: 'notifications/initialized' }
    });

    let send = (body: unknown) => rawMcp(url, { headers, body });
    let request = async (method: string, params: unknown = {}) => {
      let id = nextId++;
      let response = await send({ jsonrpc: '2.0', id, method, params });
      let message = response.messages.find(item => item.id === id) ?? response.messages[0];
      return { ...response, result: message?.result, error: message?.error };
    };

    return { session, url, token, headers, init, send, request };
  };

  it('reuses the mcp-session-id across requests on one connection', async () => {
    let client = await connect();
    let connectionId = client.init.headers.get('metorial-connection-id');

    let tools = await client.request('tools/list');
    expect(tools.status).toBe(200);
    expect(tools.headers.get('mcp-session-id')).toBe(client.token);
    expect(tools.headers.get('metorial-connection-id')).toBe(connectionId);

    let ping = await client.request('ping');
    expect(ping.result).toEqual({});
    expect(ping.headers.get('mcp-session-id')).toBe(client.token);

    let connections = await listForSession(
      org.clients.instance,
      '/session-connections',
      client.session.id
    );
    expect(connections.map(connection => connection.id)).toEqual([connectionId]);

    let second = await rawMcp(client.url, {
      headers: bearer(org.keys.instanceSecret),
      body: initializeMessage()
    });
    expect(second.status).toBe(200);
    expect(second.headers.get('mcp-session-id')).toBeTruthy();
    expect(second.headers.get('mcp-session-id')).not.toBe(client.token);

    let after = await listForSession(
      org.clients.instance,
      '/session-connections',
      client.session.id
    );
    expect(after).toHaveLength(2);
  });

  it('rejects unknown and disabled mcp-session-ids', async () => {
    let client = await connect([alphaProviderId]);

    let unknown = await rawMcp(client.url, {
      headers: { ...bearer(org.keys.instanceSecret), 'mcp-session-id': uniqueId('tok') },
      body: { jsonrpc: '2.0', id: 1, method: 'tools/list' }
    });
    expect(unknown.status).toBe(404);
    expect(JSON.parse(unknown.text)).toMatchObject({ object: 'error', code: 'not_found' });

    let deleted = await rawMcp(client.url, { method: 'DELETE', headers: client.headers });
    expect(deleted.status).toBe(200);

    let afterDelete = await client.send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
    expect(afterDelete.status).toBe(410);
    expect(JSON.parse(afterDelete.text)).toMatchObject({ object: 'error', code: 'gone' });

    let connectionId = client.init.headers.get('metorial-connection-id');
    await eventually(async () => {
      let [connection] = await listForSession(
        org.clients.instance,
        '/session-connections',
        client.session.id
      );
      expect(connection.id).toBe(connectionId);
      expect(connection.connection_state).toBe('disconnected');

      let events = await listForSession(
        org.clients.instance,
        '/session-events',
        client.session.id
      );
      expect(events.map(event => event.type)).toContain('connection_disabled');
    });
  });

  it('merges the tools of two providers in one session', async () => {
    let client = await connect();

    let { result } = await client.request('tools/list');
    let reverse = findTool(result.tools, 'reverse');
    let explode = findTool(result.tools, 'explode');
    let multiply = findTool(result.tools, 'multiply');

    let prefix = (name: string) => name.slice(0, name.indexOf('_tool_'));
    expect(prefix(reverse.name)).toBe(prefix(explode.name));
    expect(prefix(reverse.name)).not.toBe(prefix(multiply.name));
    expect(reverse.name).toMatch(/_tool_reverse$/);
    expect(multiply.name).toMatch(/_tool_multiply$/);

    expect((multiply as any).inputSchema.properties).toMatchObject({
      a: { type: 'number' },
      b: { type: 'number' }
    });
    expect((reverse as any).description).toContain('Reverses the given text');
    expect(result.tools.filter((tool: any) => tool.name === reverse.name)).toHaveLength(1);
  });

  it('routes tools/call arguments to the owning provider and returns its result', async () => {
    let client = await connect();
    let { result } = await client.request('tools/list');
    let multiply = findTool(result.tools, 'multiply');
    let reverse = findTool(result.tools, 'reverse');
    let marker = uniqueId('text');

    let product = await client.request('tools/call', {
      name: multiply.name,
      arguments: { a: 6, b: 7 }
    });
    expect(product.error).toBeUndefined();
    expect(product.result.content).toEqual([{ type: 'text', text: '42' }]);

    let reversed = await client.request('tools/call', {
      name: reverse.name,
      arguments: { text: marker }
    });
    expect(reversed.result.content).toEqual([
      { type: 'text', text: marker.split('').reverse().join('') }
    ]);

    expect(beta.toolCalls()).toContainEqual({ name: 'multiply', arguments: { a: 6, b: 7 } });
    expect(alpha.toolCalls()).toContainEqual({ name: 'reverse', arguments: { text: marker } });
    expect(alpha.toolCalls().map(call => call.name)).not.toContain('multiply');
    expect(beta.toolCalls().map(call => call.name)).not.toContain('reverse');
  });

  it('passes upstream tool failures through as isError results', async () => {
    let client = await connect([alphaProviderId]);
    let { result } = await client.request('tools/list');
    let explode = findTool(result.tools, 'explode');

    let call = await client.request('tools/call', { name: explode.name, arguments: {} });
    expect(call.status).toBe(200);
    expect(call.error).toBeUndefined();
    expect(call.result.isError).toBe(true);
    expect(call.result.content).toEqual([{ type: 'text', text: 'upstream exploded' }]);
  });

  it('answers unknown tools with a JSON-RPC error without calling upstream', async () => {
    let client = await connect([alphaProviderId]);
    let { result } = await client.request('tools/list');
    let reverse = findTool(result.tools, 'reverse');
    let missing = reverse.name.replace(/reverse$/, 'missing');

    let call = await client.request('tools/call', { name: missing, arguments: {} });
    expect(call.status).toBe(200);
    expect(call.result).toBeUndefined();
    expect(call.error).toMatchObject({ code: -32000, data: { code: 'not_found' } });
    expect(alpha.toolCalls().map(item => item.name)).not.toContain('missing');
  });

  it('answers malformed requests with JSON-RPC and HTTP errors', async () => {
    let client = await connect([alphaProviderId]);

    let invalidParams = await client.request('tools/call', {});
    expect(invalidParams.error).toMatchObject({ code: -32602, message: 'Invalid params' });

    let unknownMethod = await client.request('metorial/unknown');
    expect(unknownMethod.error).toEqual({ code: -32601, message: 'Method not found' });

    let invalidJson = await client.send('{"jsonrpc": "2.0", "id": 1, "method": ');
    expect(invalidJson.status).toBe(400);
    expect(invalidJson.text).toBe('Invalid JSON body');

    let withoutConnection = await rawMcp(client.url, {
      headers: bearer(org.keys.instanceSecret),
      body: {
        jsonrpc: '2.0',
        id: 7,
        method: 'tools/call',
        params: { name: 'anything', arguments: {} }
      }
    });
    expect(withoutConnection.status).toBe(200);
    expect(withoutConnection.messages[0]).toMatchObject({
      id: 7,
      error: { code: -32000, message: expect.stringMatching(/No connection/) }
    });
  });

  it('lists prompts, resources and resource templates of the providers', async () => {
    let client = await connect([alphaProviderId]);

    let prompts = await client.request('prompts/list');
    expect(prompts.result).toEqual({ prompts: [] });

    let templates = await client.request('resources/templates/list');
    expect(templates.result).toEqual({ resourceTemplates: [] });

    let resources = await client.request('resources/list');
    expect(resources.error).toBeUndefined();
    expect(resources.result.resources).toEqual([]);
  });
});

describe('api-connection: upstream protected by a bearer token', () => {
  let org = useOrganization();
  let server = useMcpTestServer({ bearerToken: uniqueId('upstream-token') });

  it('reports the failed upstream connection through a synthetic tool', async () => {
    let { providerId } = await createRemoteProvider(org.clients.instance, { url: server.url });
    let session = await createProviderSession(org.clients.instance, [providerId]);
    let url = connectionUrl(session.id);

    let init = await rawMcp(url, {
      headers: bearer(org.keys.instanceSecret),
      body: initializeMessage()
    });
    expect(init.status).toBe(200);

    let headers = {
      ...bearer(org.keys.instanceSecret),
      'mcp-session-id': init.headers.get('mcp-session-id')!
    };
    let list = await rawMcp(url, {
      headers,
      body: { jsonrpc: '2.0', id: 2, method: 'tools/list' }
    });
    let tools: { name: string }[] = list.messages[0].result.tools;
    let failed = tools.find(tool => tool.name.endsWith('_connection_failed'));
    expect(failed, JSON.stringify(tools.map(tool => tool.name))).toBeDefined();
    expect(tools.find(tool => tool.name.endsWith('_tool_echo'))).toBeUndefined();

    let call = await rawMcp(url, {
      headers,
      body: {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: failed!.name, arguments: {} }
      }
    });
    expect(call.messages[0]).toMatchObject({
      id: 3,
      error: {
        code: -32000,
        data: {
          code: 'provider_connection_failed',
          provider_id: session.providers[0].id,
          discovery_error: {
            type: 'connection_error',
            error: { code: 'authentication_failed' }
          }
        }
      }
    });
    expect(call.messages[0].error.message).toMatch(/HTTP 401 Unauthorized/);
    expect(server.toolCalls()).toEqual([]);
  }, 120_000);
});
