import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

let { create, handleSubspaceMcpRequest } = vi.hoisted(() => ({
  create: vi.fn(),
  handleSubspaceMcpRequest: vi.fn()
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

vi.mock('@metorial-subspace/module-connection', () => ({
  McpConnection: { create },
  handleMcpRequest: handleSubspaceMcpRequest
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
      let stdout = await readSseWithCurl(`http://127.0.0.1:${server.port}/connect/mcp/ses_1`);
      let [rawHeaders, ...bodyParts] = stdout.split('\r\n\r\n');
      let body = bodyParts.join('\r\n\r\n');

      expect(rawHeaders).toContain('HTTP/1.1 200');
      expect(rawHeaders).toContain('text/event-stream');
      expect(rawHeaders).not.toMatch(/content-length: 0/i);
      expect(body).toContain('event: endpoint');
      expect(body).toContain('connection_token=tok_1');
    } finally {
      server.stop(true);
    }
    }
  );

  it('returns completed POST requests as finite JSON responses', async () => {
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
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(response.headers.get('mcp-session-id')).toBe('tok_1');
    expect(await response.json()).toMatchObject({ jsonrpc: '2.0', id: 0 });
  });
});
