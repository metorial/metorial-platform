import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

let {
  create,
  handleSubspaceMcpRequest,
  handleSessionlessMcpRequest,
  isSessionlessMcpEnabled
} = vi.hoisted(() => ({
  create: vi.fn(),
  handleSubspaceMcpRequest: vi.fn(),
  handleSessionlessMcpRequest: vi.fn(),
  isSessionlessMcpEnabled: vi.fn(() => true)
}));

vi.mock('@metorial/fabric', () => ({
  Fabric: { fire: vi.fn() }
}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  subspaceScopeService: {
    ensureForInstance: vi.fn(async () => ({
      tenant: { id: 'ten_1' },
      solution: { id: 'sol_1' }
    }))
  }
}));

vi.mock('@metorial-subspace/module-connection', async () => ({
  ...(await import('@metorial-subspace/module-connection/src/mcp/modern')),
  McpConnection: { create },
  handleMcpRequest: handleSubspaceMcpRequest,
  handleSessionlessMcpRequest,
  isSessionlessMcpEnabled
}));

// `../src/outpost` only reaches into `@metorial/module-outpost` when an outpost signature is
// actually present, but importing it eagerly initializes Redis-backed caches -- stub it out so
// these unit tests don't need a live Redis/env setup.
vi.mock('@metorial/module-outpost', () => ({
  outpostAccessService: { isServiceGrantedForInstance: vi.fn(async () => true) },
  outpostVerificationTokens: {},
  metorialOutpostResolver: {}
}));

import { handleMcpRequest } from '../src/mcp';

let neverEndingIterator = async function* () {
  await new Promise(() => {});
};

let readSseWithCurl = async (url: string) => {
  let proc = Bun.spawn(
    [
      'curl',
      '-sS',
      '-N',
      '-D',
      '-',
      '--max-time',
      '1',
      url,
      '-H',
      'Accept: text/event-stream'
    ],
    { stdout: 'pipe', stderr: 'pipe' }
  );
  let stdout = await new Response(proc.stdout).text();
  await proc.exited;
  return stdout;
};

describe('handleMcpRequest', () => {
  beforeEach(() => {
    create.mockReset();
    handleSubspaceMcpRequest.mockReset();
    handleSessionlessMcpRequest.mockReset();
    isSessionlessMcpEnabled.mockReturnValue(true);
  });

  it.skipIf(typeof Bun === 'undefined')(
    'writes the endpoint event and keeps the stream open',
    async () => {
      let connection = {
        session: { id: 'ses_1' },
        connection: null as { id: string; token: string } | null,
        listener: vi.fn(async () => ({
          close: vi.fn(),
          iterator: neverEndingIterator
        })),
        createConnection: vi.fn(async () => {
          await new Promise(resolve => setTimeout(resolve, 30));
          connection.connection = { id: 'scon_1', token: 'tok_1' };
          return connection.connection;
        })
      };
      create.mockResolvedValue(connection);

      let app = new Hono()
        .use(async (c, next) => {
          c.res.headers.set('Access-Control-Allow-Origin', '*');
          await next();
        })
        .all('/connect/mcp/:sessionId', c =>
          handleMcpRequest(c, {
            instance: { id: 'ins_1' } as any,
            sessionId: 'ses_1'
          })
        );

      let server = Bun.serve({ port: 0, fetch: app.fetch, idleTimeout: 255 });

      try {
        let stdout = await readSseWithCurl(
          `http://127.0.0.1:${server.port}/connect/mcp/ses_1`
        );
        let [rawHeaders, ...bodyParts] = stdout.split('\r\n\r\n');
        let body = bodyParts.join('\r\n\r\n');

        expect(rawHeaders).toContain('HTTP/1.1 200');
        expect(rawHeaders).toContain('text/event-stream');
        expect(rawHeaders).not.toMatch(/content-length: 0/i);
        expect(body.startsWith('event: endpoint')).toBe(true);
        expect(body).toContain('connection_token=tok_1');
      } finally {
        server.stop(true);
      }
    }
  );

  it('returns completed POST requests as SSE responses', async () => {
    let connection = {
      session: { id: 'ses_1' },
      connection: { id: 'scon_1', token: 'tok_1' }
    };
    handleSubspaceMcpRequest.mockResolvedValue({
      connection,
      response: {
        mcp: {
          jsonrpc: '2.0',
          id: 0,
          result: {
            protocolVersion: '2025-11-25',
            capabilities: {},
            serverInfo: { name: 'Metorial', version: '1.0.0' }
          }
        }
      }
    });

    let app = new Hono().post('/connect/mcp/:sessionId', c =>
      handleMcpRequest(c, {
        instance: { id: 'ins_1' } as any,
        sessionId: 'ses_1'
      })
    );

    let response = await app.request('/connect/mcp/ses_1', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 0,
        method: 'initialize',
        params: {
          protocolVersion: '2025-11-25',
          capabilities: {},
          clientInfo: { name: 'test', version: '1.0.0' }
        }
      })
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    expect(response.headers.get('mcp-session-id')).toBe('tok_1');
    expect(await response.text()).toContain(
      `data: ${JSON.stringify({
        jsonrpc: '2.0',
        id: 0,
        result: {
          protocolVersion: '2025-11-25',
          capabilities: {},
          serverInfo: { name: 'Metorial', version: '1.0.0' }
        }
      })}\n\n`
    );
  });

  it('accepts POSTs to the legacy SSE message endpoint without waiting for the response', async () => {
    handleSubspaceMcpRequest.mockResolvedValue({
      connection: {
        session: { id: 'ses_1' },
        connection: { id: 'scon_1', token: 'tok_1' }
      },
      response: null
    });

    let app = new Hono().post('/connect/mcp/:sessionId', c =>
      handleMcpRequest(c, {
        instance: { id: 'ins_1' } as any,
        sessionId: 'ses_1'
      })
    );

    let response = await app.request('/connect/mcp/ses_1?connection_token=tok_1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' })
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('OK');
    expect(handleSubspaceMcpRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionToken: 'tok_1',
        mcpTransport: 'sse',
        waitForResponse: false
      })
    );
  });

  it('returns the stream on first progress and sends the final response later', async () => {
    let connection = {
      session: { id: 'ses_1' },
      connection: { id: 'scon_1', token: 'tok_1' }
    };
    let releaseFinal!: () => void;
    let finalReleased = new Promise<void>(resolve => {
      releaseFinal = resolve;
    });
    let progress = {
      jsonrpc: '2.0' as const,
      method: 'notifications/progress',
      params: { progressToken: 'progress_1', progress: 1 }
    };
    let finalResponse = {
      jsonrpc: '2.0' as const,
      id: 1,
      result: { content: [] }
    };

    handleSubspaceMcpRequest.mockImplementation(async input => {
      await input.onConnection(connection);
      await input.onProgress(progress);
      await finalReleased;
      return { connection, response: { mcp: finalResponse } };
    });

    let app = new Hono().post('/connect/mcp/:sessionId', c =>
      handleMcpRequest(c, {
        instance: { id: 'ins_1' } as any,
        sessionId: 'ses_1'
      })
    );

    let response = await app.request('/connect/mcp/ses_1', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'search',
          arguments: {},
          _meta: { progressToken: 'progress_1' }
        }
      })
    });

    let reader = response.body!.getReader();
    let decoder = new TextDecoder();
    expect(decoder.decode((await reader.read()).value)).toBe(
      `data: ${JSON.stringify(progress)}\n\n`
    );

    releaseFinal();
    expect(decoder.decode((await reader.read()).value)).toBe(
      `data: ${JSON.stringify(finalResponse)}\n\n`
    );
    expect((await reader.read()).done).toBe(true);
  });

  it('sends keepalive comments immediately and on idle GET streams, stopping on disconnect', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });

    try {
      let close = vi.fn();
      create.mockResolvedValue({
        session: { id: 'ses_1' },
        connection: { id: 'scon_1', token: 'tok_1' },
        listener: vi.fn(async () => ({ close, iterator: neverEndingIterator }))
      });

      let app = new Hono().get('/connect/mcp/:sessionId', c =>
        handleMcpRequest(c, {
          instance: { id: 'ins_1' } as any,
          sessionId: 'ses_1'
        })
      );

      let response = await app.request('/connect/mcp/ses_1', {
        headers: { Accept: 'text/event-stream', 'Mcp-Session-Id': 'tok_1' }
      });
      expect(response.headers.get('content-type')).toContain('text/event-stream');

      await vi.waitFor(() => expect(vi.getTimerCount()).toBe(1));

      let reader = response.body!.getReader();
      let decoder = new TextDecoder();
      expect(decoder.decode((await reader.read()).value)).toBe(': keepalive\n\n');

      let chunk = reader.read();
      vi.advanceTimersByTime(25_000);
      expect(decoder.decode((await chunk).value)).toBe(': keepalive\n\n');

      await reader.cancel();
      await vi.waitFor(() => expect(close).toHaveBeenCalled());
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('handleMcpRequest protocol detection', () => {
  let sessionlessConnection = {
    session: { id: 'ses_1' },
    connection: { id: 'scon_1', token: 'tok_1' }
  };

  let modernMeta = {
    'io.modelcontextprotocol/protocolVersion': '2026-07-28',
    'io.modelcontextprotocol/clientCapabilities': {},
    'io.modelcontextprotocol/clientInfo': { name: 'test', version: '1.0.0' }
  };

  let modernHeaders = (method: string, extra: Record<string, string> = {}) => ({
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    'MCP-Protocol-Version': '2026-07-28',
    'Mcp-Method': method,
    ...extra
  });

  let app = new Hono().post('/connect/mcp/:sessionId', c =>
    handleMcpRequest(c, {
      instance: { id: 'ins_1' } as any,
      sessionId: 'ses_1'
    })
  );

  let post = (body: unknown, headers: Record<string, string>) =>
    app.request('/connect/mcp/ses_1', {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

  let legacyResult = {
    connection: sessionlessConnection,
    response: { mcp: { jsonrpc: '2.0', id: 1, result: {} } }
  };

  beforeEach(() => {
    handleSubspaceMcpRequest.mockReset();
    handleSessionlessMcpRequest.mockReset();
    isSessionlessMcpEnabled.mockReturnValue(true);
  });

  it('routes modern requests to the sessionless pipeline as plain JSON', async () => {
    handleSessionlessMcpRequest.mockResolvedValue({
      connection: sessionlessConnection,
      mcp: { jsonrpc: '2.0', id: 1, result: { tools: [], resultType: 'complete' } },
      httpStatus: 200
    });

    let response = await post(
      { jsonrpc: '2.0', id: 1, method: 'tools/list', params: { _meta: modernMeta } },
      modernHeaders('tools/list')
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(response.headers.get('mcp-session-id')).toBeNull();
    expect(response.headers.get('mcp-protocol-version')).toBe('2026-07-28');
    expect(response.headers.get('metorial-connection-id')).toBe('scon_1');
    expect(await response.json()).toEqual({
      jsonrpc: '2.0',
      id: 1,
      result: { tools: [], resultType: 'complete' }
    });
    expect(handleSubspaceMcpRequest).not.toHaveBeenCalled();
    expect(handleSessionlessMcpRequest.mock.calls[0]![0]).toMatchObject({
      sessionId: 'ses_1',
      request: { method: 'tools/list', context: { protocolVersion: '2026-07-28' } }
    });
  });

  it('passes through the HTTP status of modern errors', async () => {
    handleSessionlessMcpRequest.mockResolvedValue({
      connection: sessionlessConnection,
      mcp: { jsonrpc: '2.0', id: 1, error: { code: -32601, message: 'Method not found' } },
      httpStatus: 404
    });

    let response = await post(
      { jsonrpc: '2.0', id: 1, method: 'logging/setLevel', params: { _meta: modernMeta } },
      modernHeaders('logging/setLevel')
    );

    expect(response.status).toBe(404);
  });

  it('keeps requests carrying a legacy session on the legacy path', async () => {
    handleSubspaceMcpRequest.mockResolvedValue(legacyResult);

    await post(
      { jsonrpc: '2.0', id: 1, method: 'tools/list', params: { _meta: modernMeta } },
      modernHeaders('tools/list', { 'Mcp-Session-Id': 'tok_1' })
    );

    expect(handleSubspaceMcpRequest).toHaveBeenCalled();
    expect(handleSessionlessMcpRequest).not.toHaveBeenCalled();
  });

  it('keeps initialize on the legacy path', async () => {
    handleSubspaceMcpRequest.mockResolvedValue(legacyResult);

    await post(
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-11-25',
          capabilities: {},
          clientInfo: { name: 'test', version: '1.0.0' }
        }
      },
      { 'Content-Type': 'application/json', 'MCP-Protocol-Version': '2025-11-25' }
    );

    expect(handleSubspaceMcpRequest).toHaveBeenCalled();
    expect(handleSessionlessMcpRequest).not.toHaveBeenCalled();
  });

  it('keeps requests without modern metadata on the legacy path', async () => {
    handleSubspaceMcpRequest.mockResolvedValue(legacyResult);

    await post(
      { jsonrpc: '2.0', id: 1, method: 'tools/list' },
      { 'Content-Type': 'application/json' }
    );

    expect(handleSubspaceMcpRequest).toHaveBeenCalled();
    expect(handleSessionlessMcpRequest).not.toHaveBeenCalled();
  });

  it('answers modern requests like an uninitialized legacy server when disabled', async () => {
    isSessionlessMcpEnabled.mockReturnValue(false);

    let response = await post(
      { jsonrpc: '2.0', id: 7, method: 'tools/list', params: { _meta: modernMeta } },
      modernHeaders('tools/list')
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      jsonrpc: '2.0',
      id: 7,
      error: { code: -32000, message: 'Bad Request: Server not initialized' }
    });
    expect(handleSubspaceMcpRequest).not.toHaveBeenCalled();
    expect(handleSessionlessMcpRequest).not.toHaveBeenCalled();
  });

  it('decides whether sessionless is enabled from the instance tenant', async () => {
    isSessionlessMcpEnabled.mockReturnValue(false);

    await post(
      { jsonrpc: '2.0', id: 7, method: 'tools/list', params: { _meta: modernMeta } },
      modernHeaders('tools/list')
    );

    expect(isSessionlessMcpEnabled).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'ten_1' })
    );
  });

  it('rejects modern requests whose headers do not match the body', async () => {
    let response = await post(
      { jsonrpc: '2.0', id: 1, method: 'tools/list', params: { _meta: modernMeta } },
      modernHeaders('tools/call')
    );

    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe(-32020);
    expect(handleSessionlessMcpRequest).not.toHaveBeenCalled();
  });

  it('accepts modern notifications with 202', async () => {
    let response = await post(
      {
        jsonrpc: '2.0',
        method: 'notifications/cancelled',
        params: { requestId: 1, _meta: modernMeta }
      },
      modernHeaders('notifications/cancelled')
    );

    expect(response.status).toBe(202);
    expect(handleSessionlessMcpRequest).not.toHaveBeenCalled();
  });

  it('streams modern progress as SSE and finishes with the final response', async () => {
    let progress = {
      jsonrpc: '2.0' as const,
      method: 'notifications/progress',
      params: { progressToken: 'p1', progress: 1 }
    };
    let finalResponse = { jsonrpc: '2.0' as const, id: 1, result: { content: [] } };

    handleSessionlessMcpRequest.mockImplementation(async input => {
      await input.onConnection(sessionlessConnection);
      await input.onProgress(progress);
      return { connection: sessionlessConnection, mcp: finalResponse, httpStatus: 200 };
    });

    let response = await post(
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'search', _meta: { ...modernMeta, progressToken: 'p1' } }
      },
      modernHeaders('tools/call', { 'Mcp-Name': 'search' })
    );

    expect(response.headers.get('content-type')).toContain('text/event-stream');
    expect(response.headers.get('mcp-session-id')).toBeNull();

    let body = await response.text();
    expect(body).toContain(`data: ${JSON.stringify(progress)}\n\n`);
    expect(body).toContain(`data: ${JSON.stringify(finalResponse)}\n\n`);
  });
});

describe('handleMcpRequest request-scoped tools', () => {
  let connection = {
    session: { id: 'ses_1' },
    connection: { id: 'scon_1', token: 'tok_1' }
  };

  let requestTools = vi.fn(async () => ({ tools: [], call: vi.fn() }));

  let app = new Hono().all('/connect/mcp/:sessionId', c =>
    handleMcpRequest(c, {
      instance: { id: 'ins_1' } as any,
      sessionId: 'ses_1',
      requestTools
    })
  );

  let toolsList = { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} };

  beforeEach(() => {
    create.mockReset();
    handleSubspaceMcpRequest.mockReset();
    handleSessionlessMcpRequest.mockReset();
    requestTools.mockClear();
    isSessionlessMcpEnabled.mockReturnValue(true);
  });

  it('passes the request tools resolver to streamable HTTP requests', async () => {
    handleSubspaceMcpRequest.mockResolvedValue({
      connection,
      response: { mcp: { jsonrpc: '2.0', id: 1, result: { tools: [] } } }
    });

    await app.request('/connect/mcp/ses_1', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'Mcp-Session-Id': 'tok_1'
      },
      body: JSON.stringify(toolsList)
    });

    expect(handleSubspaceMcpRequest.mock.calls[0]![0].requestTools).toBe(requestTools);
    expect(requestTools).not.toHaveBeenCalled();
  });

  it('passes request tools to legacy SSE message posts via the streamable branch', async () => {
    handleSubspaceMcpRequest.mockResolvedValue({ connection, response: null });

    await app.request('/connect/mcp/ses_1?connection_token=tok_1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toolsList)
    });

    expect(handleSubspaceMcpRequest.mock.calls[0]![0].requestTools).toBe(requestTools);
  });

  it('passes request tools to sessionless requests', async () => {
    handleSessionlessMcpRequest.mockResolvedValue({
      connection,
      mcp: { jsonrpc: '2.0', id: 1, result: { tools: [], resultType: 'complete' } },
      httpStatus: 200
    });

    await app.request('/connect/mcp/ses_1', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'MCP-Protocol-Version': '2026-07-28',
        'Mcp-Method': 'tools/list'
      },
      body: JSON.stringify({
        ...toolsList,
        params: {
          _meta: {
            'io.modelcontextprotocol/protocolVersion': '2026-07-28',
            'io.modelcontextprotocol/clientCapabilities': {},
            'io.modelcontextprotocol/clientInfo': { name: 'test', version: '1.0.0' }
          }
        }
      })
    });

    expect(handleSessionlessMcpRequest.mock.calls[0]![0].requestTools).toBe(requestTools);
  });

  it('passes request tools to connections created for DELETE requests', async () => {
    create.mockResolvedValue({ ...connection, disableConnection: vi.fn() });

    await app.request('/connect/mcp/ses_1', {
      method: 'DELETE',
      headers: { 'Mcp-Session-Id': 'tok_1' }
    });

    expect(create.mock.calls[0]![0].requestTools).toBe(requestTools);
  });
});
