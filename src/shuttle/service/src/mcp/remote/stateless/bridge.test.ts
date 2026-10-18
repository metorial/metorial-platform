import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse
} from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConnectionMessage } from '../../utils/messenger';

vi.mock('../../../lib/http/fetchSsrf', () => ({
  safeFetch: (input: string, { egressPolicy: _egressPolicy, ...init }: any) =>
    fetch(input, init)
}));

let { StatelessMcpBridge } = await import('./bridge');

interface ReceivedRequest {
  headers: IncomingMessage['headers'];
  body: any;
}

interface TestServerState {
  mode: 'modern' | 'legacy';
  listChanged: boolean;
  received: ReceivedRequest[];
  slowRequestClosed: boolean;
}

let state: TestServerState;
let server: Server;
let url: string;
let emitted: ConnectionMessage[];
let bridge: InstanceType<typeof StatelessMcpBridge>;

let tools = [
  {
    name: 'echo',
    inputSchema: { type: 'object', properties: { text: { type: 'string' } } }
  },
  {
    name: 'regional',
    inputSchema: {
      type: 'object',
      properties: { region: { type: 'string', 'x-mcp-header': 'Region' } }
    }
  },
  {
    name: 'broken',
    inputSchema: {
      type: 'object',
      properties: { amount: { type: 'number', 'x-mcp-header': 'Amount' } }
    }
  }
];

let sendJson = (res: ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
};

let sendError = (res: ServerResponse, status: number, id: unknown, code: number) => {
  sendJson(res, status, { jsonrpc: '2.0', id, error: { code, message: `error ${code}` } });
};

let openStream = (res: ServerResponse) => {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'X-Accel-Buffering': 'no' });
  return (message: unknown) => res.write(`data: ${JSON.stringify(message)}\n\n`);
};

let handleRequest = (req: IncomingMessage, res: ServerResponse, body: any) => {
  if (state.mode == 'legacy') {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('Bad Request: No valid session ID provided');
    return;
  }

  if (req.method != 'POST') {
    res.writeHead(405).end();
    return;
  }

  let meta = body.params?._meta ?? {};
  let headerMismatch =
    req.headers['mcp-protocol-version'] != '2026-07-28' ||
    meta['io.modelcontextprotocol/protocolVersion'] != '2026-07-28' ||
    req.headers['mcp-method'] != body.method;

  if (headerMismatch) return sendError(res, 400, body.id, -32020);

  switch (body.method) {
    case 'server/discover':
      return sendJson(res, 200, {
        jsonrpc: '2.0',
        id: body.id,
        result: {
          resultType: 'complete',
          supportedVersions: ['2026-07-28'],
          capabilities: { tools: { listChanged: state.listChanged } },
          instructions: 'Use the echo tool',
          _meta: { 'io.modelcontextprotocol/serverInfo': { name: 'test', version: '2.0.0' } }
        }
      });

    case 'tools/list':
      return sendJson(res, 200, {
        jsonrpc: '2.0',
        id: body.id,
        result: { resultType: 'complete', tools, ttlMs: 1000, cacheScope: 'private' }
      });

    case 'subscriptions/listen': {
      let write = openStream(res);
      let subscriptionMeta = { 'io.modelcontextprotocol/subscriptionId': body.id };

      write({
        jsonrpc: '2.0',
        method: 'notifications/subscriptions/acknowledged',
        params: { _meta: subscriptionMeta, notifications: body.params.notifications }
      });
      write({
        jsonrpc: '2.0',
        method: 'notifications/tools/list_changed',
        params: { _meta: subscriptionMeta }
      });
      return;
    }

    case 'tools/call':
      return handleToolCall(req, res, body);

    default:
      return sendError(res, 404, body.id, -32601);
  }
};

let handleToolCall = (req: IncomingMessage, res: ServerResponse, body: any) => {
  let name = body.params.name;
  if (req.headers['mcp-name'] != name) return sendError(res, 400, body.id, -32020);

  if (name == 'echo') {
    let write = openStream(res);
    write({ jsonrpc: '2.0', method: 'notifications/progress', params: { progress: 1 } });
    write({
      jsonrpc: '2.0',
      id: body.id,
      result: {
        resultType: 'complete',
        content: [{ type: 'text', text: body.params.arguments.text }]
      }
    });
    res.end();
    return;
  }

  if (name == 'regional') {
    if (req.headers['mcp-param-region'] != body.params.arguments.region) {
      return sendError(res, 400, body.id, -32020);
    }

    return sendJson(res, 200, {
      jsonrpc: '2.0',
      id: body.id,
      result: { resultType: 'complete', content: [] }
    });
  }

  if (name == 'ask') {
    let answer = body.params.inputResponses?.login?.content?.name;

    if (!answer || body.params.requestState != 'state-1') {
      return sendJson(res, 200, {
        jsonrpc: '2.0',
        id: body.id,
        result: {
          resultType: 'input_required',
          inputRequests: {
            login: {
              method: 'elicitation/create',
              params: { mode: 'form', message: 'Name?', requestedSchema: { type: 'object' } }
            }
          },
          requestState: 'state-1'
        }
      });
    }

    return sendJson(res, 200, {
      jsonrpc: '2.0',
      id: body.id,
      result: { resultType: 'complete', content: [{ type: 'text', text: `hi ${answer}` }] }
    });
  }

  if (name == 'slow') {
    openStream(res);
    res.on('close', () => {
      state.slowRequestClosed = true;
    });
    return;
  }

  return sendError(res, 400, body.id, -32602);
};

let waitFor = async <T>(find: () => T | undefined, timeoutMs = 2000): Promise<T> => {
  let startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    let value = find();
    if (value !== undefined) return value;
    await new Promise(resolve => setTimeout(resolve, 5));
  }

  throw new Error('Timed out waiting for condition');
};

let findResponse = (id: string | number) =>
  waitFor(() => {
    let message = emitted.find(
      m =>
        m.type == 'mcp.message' && 'id' in m.data && !('method' in m.data) && m.data.id === id
    );
    return message?.type == 'mcp.message' ? (message.data as any) : undefined;
  });

let findMessage = (predicate: (message: any) => boolean) =>
  waitFor(() => {
    let message = emitted.find(m => m.type == 'mcp.message' && predicate(m.data));
    return message?.type == 'mcp.message' ? (message.data as any) : undefined;
  });

let receivedFor = (method: string) => state.received.filter(r => r.body.method == method);

let initialize = async (capabilities: Record<string, unknown> = {}) => {
  await bridge.handle({
    jsonrpc: '2.0',
    id: 'init',
    method: 'initialize',
    params: {
      protocolVersion: '2025-06-18',
      capabilities,
      clientInfo: { name: 'Test Client', version: '1.0.0' }
    }
  } as JSONRPCMessage);

  return findResponse('init');
};

beforeEach(async () => {
  state = { mode: 'modern', listChanged: false, received: [], slowRequestClosed: false };
  emitted = [];

  server = createServer((req, res) => {
    let chunks: Buffer[] = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      let raw = Buffer.concat(chunks).toString('utf8');
      let body = raw ? JSON.parse(raw) : {};

      state.received.push({ headers: req.headers, body });
      handleRequest(req, res, body);
    });
  });

  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/mcp`;

  bridge = new StatelessMcpBridge({
    url,
    getHeaders: async () => ({ Authorization: 'Bearer token' }),
    emit: async message => {
      emitted.push(message);
    },
    log: () => {},
    inputResponseTimeoutMs: 2000
  });
});

afterEach(async () => {
  bridge.close();
  server.closeAllConnections();
  await new Promise<void>(resolve => server.close(() => resolve()));
});

describe('StatelessMcpBridge', () => {
  it('translates initialize into server/discover', async () => {
    let response = await initialize({ elicitation: {} });

    expect(response.result).toEqual({
      protocolVersion: '2025-06-18',
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: 'test', version: '2.0.0' },
      instructions: 'Use the echo tool'
    });

    let [discover] = receivedFor('server/discover');
    expect(discover!.headers.authorization).toBe('Bearer token');
    expect(discover!.headers['mcp-session-id']).toBeUndefined();
    expect(discover!.body.params._meta).toEqual({
      'io.modelcontextprotocol/protocolVersion': '2026-07-28',
      'io.modelcontextprotocol/clientInfo': { name: 'Test Client', version: '1.0.0' },
      'io.modelcontextprotocol/clientCapabilities': { elicitation: {} }
    });
  });

  it('reports legacy servers as not supporting the stateless protocol', async () => {
    state.mode = 'legacy';

    await bridge.handle({
      jsonrpc: '2.0',
      id: 'init',
      method: 'initialize',
      params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: {} }
    } as JSONRPCMessage);

    let error = await waitFor(() => emitted.find(m => m.type == 'error'));
    expect(error.data).toMatchObject({ code: 'stateless_protocol_unsupported' });
  });

  it('answers ping and logging/setLevel locally and sends the log level in _meta', async () => {
    await initialize();

    await bridge.handle({ jsonrpc: '2.0', id: 'ping', method: 'ping' } as JSONRPCMessage);
    await bridge.handle({
      jsonrpc: '2.0',
      id: 'level',
      method: 'logging/setLevel',
      params: { level: 'debug' }
    } as JSONRPCMessage);

    expect((await findResponse('ping')).result).toEqual({});
    expect((await findResponse('level')).result).toEqual({});
    expect(receivedFor('ping')).toHaveLength(0);

    await bridge.handle({
      jsonrpc: '2.0',
      id: 'list',
      method: 'tools/list'
    } as JSONRPCMessage);
    await findResponse('list');

    expect(receivedFor('tools/list')[0]!.body.params._meta).toMatchObject({
      'io.modelcontextprotocol/logLevel': 'debug'
    });
  });

  it('streams request-scoped notifications before the final result', async () => {
    await initialize();

    await bridge.handle({
      jsonrpc: '2.0',
      id: 7,
      method: 'tools/call',
      params: { name: 'echo', arguments: { text: 'hello' } }
    } as JSONRPCMessage);

    let response = await findResponse(7);
    expect(response.result.content).toEqual([{ type: 'text', text: 'hello' }]);

    let messages = emitted.filter(m => m.type == 'mcp.message').map(m => m.data as any);
    let progressIndex = messages.findIndex(m => m.method == 'notifications/progress');
    let resultIndex = messages.findIndex(m => m.id === 7);
    expect(progressIndex).toBeGreaterThanOrEqual(0);
    expect(progressIndex).toBeLessThan(resultIndex);

    expect(receivedFor('tools/call')[0]!.headers['mcp-name']).toBe('echo');
  });

  it('filters invalid tools and mirrors x-mcp-header parameters', async () => {
    await initialize();

    await bridge.handle({
      jsonrpc: '2.0',
      id: 'list',
      method: 'tools/list'
    } as JSONRPCMessage);
    let list = await findResponse('list');
    expect(list.result.tools.map((tool: any) => tool.name)).toEqual(['echo', 'regional']);

    await bridge.handle({
      jsonrpc: '2.0',
      id: 'call',
      method: 'tools/call',
      params: { name: 'regional', arguments: { region: 'eu-west-1' } }
    } as JSONRPCMessage);

    expect((await findResponse('call')).result).toBeDefined();
    expect(receivedFor('tools/call')).toHaveLength(1);
    expect(receivedFor('tools/call')[0]!.headers['mcp-param-region']).toBe('eu-west-1');
  });

  it('refreshes tool schemas and retries once on HeaderMismatch', async () => {
    await initialize();

    await bridge.handle({
      jsonrpc: '2.0',
      id: 'call',
      method: 'tools/call',
      params: { name: 'regional', arguments: { region: 'us-east-1' } }
    } as JSONRPCMessage);

    let response = await findResponse('call');
    expect(response.error).toBeUndefined();
    expect(receivedFor('tools/list')).toHaveLength(1);
    expect(receivedFor('tools/call').map(r => r.headers['mcp-param-region'])).toEqual([
      undefined,
      'us-east-1'
    ]);
  });

  it('forwards JSON-RPC errors from 4xx responses as normal responses', async () => {
    await initialize();

    await bridge.handle({
      jsonrpc: '2.0',
      id: 'prompts',
      method: 'prompts/list'
    } as JSONRPCMessage);

    let response = await findResponse('prompts');
    expect(response.error.code).toBe(-32601);
    expect(emitted.some(m => m.type == 'error')).toBe(false);
  });

  it('bridges input_required results to legacy server-to-client requests', async () => {
    await initialize({ elicitation: {} });

    await bridge.handle({
      jsonrpc: '2.0',
      id: 'ask',
      method: 'tools/call',
      params: { name: 'ask', arguments: {} }
    } as JSONRPCMessage);

    let elicitation = await findMessage(m => m.method == 'elicitation/create');
    expect(elicitation.params.message).toBe('Name?');

    await bridge.handle({
      jsonrpc: '2.0',
      id: elicitation.id,
      result: { action: 'accept', content: { name: 'Ada' } }
    } as JSONRPCMessage);

    let response = await findResponse('ask');
    expect(response.result.content).toEqual([{ type: 'text', text: 'hi Ada' }]);

    let [first, retry] = receivedFor('tools/call');
    expect(retry!.body.id).not.toBe(first!.body.id);
    expect(retry!.body.params).toMatchObject({
      inputResponses: { login: { action: 'accept', content: { name: 'Ada' } } },
      requestState: 'state-1'
    });
  });

  it('rejects input requests the client did not declare support for', async () => {
    await initialize();

    await bridge.handle({
      jsonrpc: '2.0',
      id: 'ask',
      method: 'tools/call',
      params: { name: 'ask', arguments: {} }
    } as JSONRPCMessage);

    let response = await findResponse('ask');
    expect(response.error.code).toBe(-32021);
    expect(emitted.some(m => m.type == 'mcp.message' && 'method' in m.data)).toBe(false);
  });

  it('cancels in-flight requests by closing the response stream', async () => {
    await initialize();

    await bridge.handle({
      jsonrpc: '2.0',
      id: 'slow',
      method: 'tools/call',
      params: { name: 'slow', arguments: {} }
    } as JSONRPCMessage);
    await waitFor(() => (receivedFor('tools/call').length ? true : undefined));

    await bridge.handle({
      jsonrpc: '2.0',
      method: 'notifications/cancelled',
      params: { requestId: 'slow' }
    } as JSONRPCMessage);

    await waitFor(() => (state.slowRequestClosed ? true : undefined));
    expect(emitted.some(m => m.type == 'error')).toBe(false);
  });

  it('delivers list-changed notifications through subscriptions/listen', async () => {
    state.listChanged = true;
    await initialize();

    let notification = await findMessage(m => m.method == 'notifications/tools/list_changed');
    expect(notification.params).toEqual({});

    expect(receivedFor('subscriptions/listen')[0]!.body.params.notifications).toEqual({
      toolsListChanged: true
    });
    expect(
      emitted.some(
        m =>
          m.type == 'mcp.message' &&
          (m.data as any).method == 'notifications/subscriptions/acknowledged'
      )
    ).toBe(false);
  });

  it('maps resources/subscribe onto the subscription filter', async () => {
    await initialize();

    await bridge.handle({
      jsonrpc: '2.0',
      id: 'sub',
      method: 'resources/subscribe',
      params: { uri: 'file:///a.json' }
    } as JSONRPCMessage);

    expect((await findResponse('sub')).result).toEqual({});

    let listen = await waitFor(() => receivedFor('subscriptions/listen')[0]);
    expect(listen.body.params.notifications).toEqual({
      resourceSubscriptions: ['file:///a.json']
    });
  });
});
