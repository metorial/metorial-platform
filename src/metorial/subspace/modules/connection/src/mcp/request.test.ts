import { beforeEach, describe, expect, it, vi } from 'vitest';

let { create } = vi.hoisted(() => ({ create: vi.fn() }));

vi.mock('./connection', () => ({
  McpConnection: { create }
}));

import { handleMcpRequest } from './request';

describe('handleMcpRequest', () => {
  beforeEach(() => {
    create.mockReset();
  });

  it('streams progress for long-running MCP methods', async () => {
    let onProgress = vi.fn();
    let onConnection = vi.fn();
    let connection = {
      handleMessageWithProgress: vi.fn(async (_message, _opts, emit) => {
        await emit({ mcp: { jsonrpc: '2.0', method: 'notifications/progress' } });
        return { mcp: { jsonrpc: '2.0', id: 1, result: { content: [] } } };
      }),
      handleMessage: vi.fn()
    };
    create.mockResolvedValue(connection);

    let result = await handleMcpRequest({
      solutionId: 'solution_1',
      tenantId: 'tenant_1',
      sessionId: 'session_1',
      mcpTransport: 'streamable_http',
      message: {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'search', arguments: {} }
      },
      waitForResponse: true,
      onProgress,
      onConnection
    });

    expect(result.connection).toBe(connection);
    expect(onConnection).toHaveBeenCalledWith(connection);
    expect(onConnection.mock.invocationCallOrder[0]!).toBeLessThan(
      connection.handleMessageWithProgress.mock.invocationCallOrder[0]!
    );
    expect(connection.handleMessageWithProgress).toHaveBeenCalled();
    expect(connection.handleMessage).not.toHaveBeenCalled();
    expect(onProgress).toHaveBeenCalledWith({
      jsonrpc: '2.0',
      method: 'notifications/progress'
    });
  });
});
