import { beforeEach, describe, expect, it, vi } from 'vitest';

let { handleMcpRequest } = vi.hoisted(() => ({
  handleMcpRequest: vi.fn()
}));

vi.mock('@metorial-subspace/module-connection', () => ({
  handleMcpRequest
}));

import { sessionMcpMessagingService } from './sessionMcpMessaging';

describe('sessionMcpMessagingService', () => {
  beforeEach(() => {
    handleMcpRequest.mockReset();
  });

  it('returns connection metadata and forwards progress', async () => {
    let progress = vi.fn();
    let progressMessage = {
      jsonrpc: '2.0' as const,
      method: 'notifications/progress',
      params: { progressToken: 'p1', progress: 1 }
    };
    let responseMessage = {
      jsonrpc: '2.0' as const,
      id: 1,
      result: { content: [] }
    };

    handleMcpRequest.mockImplementation(async input => {
      await input.onProgress(progressMessage);
      return {
        connection: {
          session: { id: 'session_internal' },
          connection: { id: 'connection_1', token: 'token_1' }
        },
        response: { mcp: responseMessage }
      };
    });

    await expect(
      sessionMcpMessagingService.send({
        solutionId: 'solution_1',
        tenantId: 'tenant_1',
        sessionId: 'session_1',
        connectionToken: 'existing_token',
        message: {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name: 'search', arguments: {} }
        },
        onProgress: progress
      })
    ).resolves.toEqual({
      responses: [responseMessage],
      sessionId: 'session_internal',
      connection: { id: 'connection_1', token: 'token_1' }
    });

    expect(progress).toHaveBeenCalledWith(progressMessage);
    expect(handleMcpRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        solutionId: 'solution_1',
        tenantId: 'tenant_1',
        sessionId: 'session_1',
        connectionToken: 'existing_token',
        mcpTransport: 'streamable_http',
        waitForResponse: true
      })
    );
  });
});
