import { describe, expect, it, vi } from 'vitest';
import { InternalMcpTransport } from './mcp';
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

describe('InternalMcpTransport', () => {
  it('returns cached tools without forwarding tools/list', async () => {
    let sendMessage = vi.fn();
    let transport = new InternalMcpTransport({
      sendMessage,
      getCachedTools: async () => toolList
    });
    let messages: unknown[] = [];

    transport.onmessage = message => messages.push(message);

    await transport.start();
    await transport.send({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list'
    });

    expect(sendMessage).not.toHaveBeenCalled();
    expect(messages).toEqual([
      {
        jsonrpc: '2.0',
        id: 1,
        result: toolList
      }
    ]);
  });

  it('captures and reuses Subspace connection tokens', async () => {
    let connections: unknown[] = [];
    let messages: unknown[] = [];
    let calls: Array<string | null | undefined> = [];
    let sendMessage = vi.fn(
      async (message: any, connectionToken: string | null | undefined) => {
        calls.push(connectionToken);
        return {
          responses: [
            {
              jsonrpc: '2.0',
              id: message.id,
              result: calls.length == 1 ? { protocolVersion: '2025-06-18' } : { content: [] }
            }
          ],
          connection: { id: 'conn_1', token: 'token_1' }
        };
      }
    );

    let transport = new InternalMcpTransport({
      sendMessage,
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
    expect(calls[1]).toBe('token_1');
    expect(messages).toHaveLength(2);
  });
});
