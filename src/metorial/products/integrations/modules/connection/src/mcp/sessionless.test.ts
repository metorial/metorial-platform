import { beforeEach, describe, expect, it, vi } from 'vitest';

let { create } = vi.hoisted(() => ({ create: vi.fn() }));

vi.mock('./connection', () => ({
  McpConnection: { create }
}));

import { buildSessionlessClientKey } from './modern/clientKey';
import { handleSessionlessMcpRequest, type SessionlessMcpRequest } from './sessionless';

let serverInfo = { name: 'Slack', title: 'Slack', version: '1.0.0', description: '' };

let oauthClient = {
  name: 'Claude',
  type: 'mcp_client_oauth' as const,
  foreignId: 'client_1',
  oauthRegistrationId: 'reg_1'
};

let createRequest = (method: string, params: Record<string, any> = {}) =>
  ({
    type: 'request',
    id: 1,
    method,
    message: { jsonrpc: '2.0', id: 1, method, params },
    context: {
      protocolVersion: '2026-07-28',
      clientCapabilities: {},
      clientInfo: { name: 'ExampleClient', version: '1.0.0' }
    }
  }) satisfies SessionlessMcpRequest;

let createConnection = (mcp: any) => ({
  resolveSessionlessConnection: vi.fn(async () => ({})),
  handleMessage: vi.fn(async () => ({ message: null, mcp })),
  handleMessageWithProgress: vi.fn(async (_message, _opts, emit) => {
    await emit({ mcp: { jsonrpc: '2.0', method: 'notifications/progress' } });
    return { message: null, mcp };
  }),
  getServerInfo: vi.fn(async () => serverInfo)
});

let baseInput = {
  sessionId: 'ses_1',
  solutionId: 'sol_1',
  tenantId: 'ten_1'
};

describe('handleSessionlessMcpRequest', () => {
  beforeEach(() => {
    create.mockReset();
  });

  it('resolves a sessionless connection attributed to the agent client', async () => {
    let connection = createConnection({ jsonrpc: '2.0', id: 1, result: { tools: [] } });
    create.mockResolvedValue(connection);

    await handleSessionlessMcpRequest({
      ...baseInput,
      agentClient: oauthClient,
      request: createRequest('tools/list'),
      clientIp: '::ffff:1.2.3.4'
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'ses_1',
        agentClient: oauthClient,
        mcpTransport: 'sessionless'
      })
    );
    expect(create.mock.calls[0]![0]).not.toHaveProperty('connectionToken');

    expect(connection.resolveSessionlessConnection).toHaveBeenCalledWith({
      clientKey: await buildSessionlessClientKey({
        clientInfo: { name: 'ExampleClient', version: '1.0.0' },
        clientIp: '1.2.3.4',
        agentClient: oauthClient
      }),
      client: {
        name: 'ExampleClient',
        version: '1.0.0',
        identifier: 'ExampleClient@1.0.0'
      },
      mcpCapabilities: {},
      mcpProtocolVersion: '2026-07-28'
    });
  });

  it('decorates results for the modern protocol', async () => {
    create.mockResolvedValue(
      createConnection({ jsonrpc: '2.0', id: 1, result: { tools: [] } })
    );

    let result = await handleSessionlessMcpRequest({
      ...baseInput,
      request: createRequest('tools/list')
    });

    expect(result.httpStatus).toBe(200);
    expect(result.mcp).toEqual({
      jsonrpc: '2.0',
      id: 1,
      result: {
        tools: [],
        resultType: 'complete',
        ttlMs: 60_000,
        cacheScope: 'private',
        _meta: { 'io.modelcontextprotocol/serverInfo': serverInfo }
      }
    });
  });

  it('maps method-not-found to HTTP 404', async () => {
    create.mockResolvedValue(
      createConnection({
        jsonrpc: '2.0',
        id: 1,
        error: { code: -32601, message: 'Method not found' }
      })
    );

    let result = await handleSessionlessMcpRequest({
      ...baseInput,
      request: createRequest('logging/setLevel')
    });

    expect(result.httpStatus).toBe(404);
  });

  it('streams progress for long-running methods', async () => {
    let connection = createConnection({ jsonrpc: '2.0', id: 1, result: { content: [] } });
    create.mockResolvedValue(connection);
    let onProgress = vi.fn();

    await handleSessionlessMcpRequest({
      ...baseInput,
      request: createRequest('tools/call', { name: 'search', _meta: { progressToken: 'p1' } }),
      onProgress
    });

    expect(connection.handleMessageWithProgress).toHaveBeenCalled();
    expect(onProgress).toHaveBeenCalledWith({
      jsonrpc: '2.0',
      method: 'notifications/progress'
    });
  });
});
