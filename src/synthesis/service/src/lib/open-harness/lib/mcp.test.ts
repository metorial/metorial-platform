import { describe, expect, it, vi } from 'vitest';
import { ReusableHttpMcpTransport } from './mcp';
import type { SubspaceMcpToolList } from '../../../types';

let toolList = {
  tools: [
    {
      name: 'search',
      description: 'Search things',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    }
  ]
} satisfies SubspaceMcpToolList;

describe('ReusableHttpMcpTransport', () => {
  it('returns cached tools without forwarding tools/list', async () => {
    let transport = new ReusableHttpMcpTransport({
      url: 'http://subspace.test/solution/tenant/sessions/session/mcp',
      getCachedTools: async () => toolList
    });
    let messages: unknown[] = [];
    let fetchMock = vi.fn();

    vi.stubGlobal('fetch', fetchMock);
    transport.onmessage = message => messages.push(message);

    await transport.start();
    await transport.send({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list'
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(messages).toEqual([
      {
        jsonrpc: '2.0',
        id: 1,
        result: toolList
      }
    ]);

    vi.unstubAllGlobals();
  });

  it('captures and reuses Subspace connection tokens', async () => {
    let connections: unknown[] = [];
    let messages: unknown[] = [];
    let calls: RequestInit[] = [];
    let fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      calls.push(init);

      return new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          id: calls.length,
          result: calls.length == 1 ? { protocolVersion: '2025-06-18' } : { content: [] }
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Metorial-Connection-Id': 'conn_1',
            'Metorial-Connection-Token': 'token_1',
            'Mcp-Session-Id': 'token_1'
          }
        }
      );
    });

    vi.stubGlobal('fetch', fetchMock);

    let transport = new ReusableHttpMcpTransport({
      url: 'http://subspace.test/solution/tenant/sessions/session/mcp',
      onConnection: async connection => {
        connections.push(connection);
      }
    });

    transport.onmessage = message => messages.push(message);

    await transport.start();
    await transport.send({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {}
    });
    await transport.send({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'search', arguments: {} }
    });

    expect(connections).toEqual([
      {
        connectionId: 'conn_1',
        connectionToken: 'token_1',
        mcpSessionId: 'token_1'
      },
      {
        connectionId: 'conn_1',
        connectionToken: 'token_1',
        mcpSessionId: 'token_1'
      }
    ]);
    expect((calls[1]!.headers as Record<string, string>)['MCP-Session-ID']).toBe('token_1');
    expect(messages).toHaveLength(2);

    vi.unstubAllGlobals();
  });
});
