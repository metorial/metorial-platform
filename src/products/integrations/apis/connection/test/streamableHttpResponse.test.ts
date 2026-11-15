import { describe, expect, it, vi } from 'vitest';
import {
  createStreamableHttpResponse,
  missingMcpResponse
} from '../src/streamableHttpResponse';

describe('createStreamableHttpResponse', () => {
  it('does not start until the first message is written', async () => {
    let stream = createStreamableHttpResponse();
    let onStarted = vi.fn();
    void stream.started.then(onStarted);

    await Promise.resolve();
    expect(onStarted).not.toHaveBeenCalled();

    stream.write({
      jsonrpc: '2.0',
      method: 'notifications/progress',
      params: { progressToken: 'test', progress: 1 }
    });
    await stream.started;

    expect(onStarted).toHaveBeenCalledOnce();
  });

  it('streams messages written after the response has started', async () => {
    let stream = createStreamableHttpResponse();
    let reader = stream.response.body!.getReader();
    let decoder = new TextDecoder();
    let progress = {
      jsonrpc: '2.0' as const,
      method: 'notifications/progress',
      params: { progressToken: 'test', progress: 1 }
    };
    let response = {
      jsonrpc: '2.0' as const,
      id: 1,
      result: { content: [] }
    };

    stream.write(progress);
    expect(decoder.decode((await reader.read()).value)).toBe(
      `data: ${JSON.stringify(progress)}\n\n`
    );

    stream.write(response);
    stream.close();
    expect(decoder.decode((await reader.read()).value)).toBe(
      `data: ${JSON.stringify(response)}\n\n`
    );
    expect((await reader.read()).done).toBe(true);
  });

  it('creates an MCP error for a missing final response', () => {
    expect(
      missingMcpResponse({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: {} })
    ).toEqual({
      jsonrpc: '2.0',
      id: 1,
      error: {
        code: -32603,
        message: 'No response produced for MCP request'
      }
    });
  });
});
