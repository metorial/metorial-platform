import { describe, expect, it } from 'vitest';
import { createStreamableHttpPostResponse } from '../src/streamableHttpResponse';

let request = {
  jsonrpc: '2.0' as const,
  id: 0,
  method: 'initialize',
  params: {}
};

let response = {
  jsonrpc: '2.0' as const,
  id: 0,
  result: { protocolVersion: '2025-11-25' }
};

describe('createStreamableHttpPostResponse', () => {
  it('returns a finite JSON response when no progress was emitted', async () => {
    let result = createStreamableHttpPostResponse({ request, response, progress: [] });

    expect(result.status).toBe(200);
    expect(result.headers.get('content-type')).toContain('application/json');
    expect(await result.json()).toEqual(response);
  });

  it('uses SSE when progress events need to precede the result', async () => {
    let progress = {
      jsonrpc: '2.0' as const,
      method: 'notifications/progress',
      params: { progressToken: 'test', progress: 1 }
    };
    let result = createStreamableHttpPostResponse({ request, response, progress: [progress] });

    expect(result.headers.get('content-type')).toContain('text/event-stream');
    expect(await result.text()).toBe(
      `data: ${JSON.stringify(progress)}\n\ndata: ${JSON.stringify(response)}\n\n`
    );
  });

  it('returns 202 for notifications with no response', () => {
    let notification = {
      jsonrpc: '2.0' as const,
      method: 'notifications/initialized'
    };
    let result = createStreamableHttpPostResponse({
      request: notification,
      response: null,
      progress: []
    });

    expect(result.status).toBe(202);
  });
});
