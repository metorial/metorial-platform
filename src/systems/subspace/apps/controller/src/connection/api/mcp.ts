import { delay } from '@lowerdeck/delay';
import { createHono } from '@lowerdeck/hono';
import { McpConnection } from '@metorial-subspace/module-connection';
import { streamSSE } from 'hono/streaming';

let isDev = process.env.NODE_ENV !== 'production';

type Transports = 'sse' | 'streamable_http';

export let mcpRouter = createHono().all(`/:key?`, async c => {
  if (isDev) {
    c.res.headers.set('Access-Control-Allow-Origin', '*');
    c.res.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE');
    c.res.headers.set(
      'Access-Control-Allow-Headers',
      'Content-Type, Metorial-Proxy-URL, MCP-Protocol-Version, MCP-Session-ID, Authorization'
    );
    c.res.headers.set('Access-Control-Allow-Credentials', 'true');
    c.res.headers.set(
      'Access-Control-Expose-Headers',
      'Metorial-Connection-Id, Metorial-Connection-Token, MCP-Session-ID'
    );

    if (c.req.method === 'OPTIONS') {
      return c.text('OK', 200);
    }
  }

  let queryConnectionId = c.req.query('connection_token');
  let mcpSessionId = c.req.header('mcp-session-id');

  let transport: Transports = 'sse';
  if (mcpSessionId || (c.req.method === 'POST' && !queryConnectionId))
    transport = 'streamable_http';

  let baseParams = {
    connectionToken: mcpSessionId || queryConnectionId,
    sessionId: c.req.param('sessionId')!,
    solutionId: c.req.param('solutionId')!,
    tenantId: c.req.param('tenantId')!,
    mcpTransport: transport
  };

  let metorialProxyUrl = c.req.header('metorial-proxy-url');
  if (!metorialProxyUrl) {
    if (!isDev) return c.text('Missing Metorial-Proxy-URL header', 400);
    metorialProxyUrl = c.req.url;
  }

  if (transport === 'sse') {
    if (c.req.method === 'GET') {
      return streamSSE(c, async stream => {
        let con = await McpConnection.create(baseParams);

        let listenerStream = await con.listener({ selectedChannels: 'all' });

        stream.onAbort(async () => {
          await listenerStream.close();
        });

        let connection = await con.createConnection();
        let endpoint = new URL(metorialProxyUrl);
        endpoint.searchParams.set('connection_token', connection.token);

        if (con.connection) {
          c.res.headers.set('mcp-session-id', con.connection.token);
          c.res.headers.set('Metorial-Connection-Id', con.connection.id);
          c.res.headers.set('Metorial-Connection-Token', con.connection.token);
        }

        await stream.writeSSE({
          event: 'endpoint',
          data: endpoint.toString()
        });

        for await (let event of listenerStream.iterator()) {
          await stream.writeSSE({
            id: event.message?.id,
            data: JSON.stringify(event.mcp)
          });
        }
      });
    }

    if (c.req.method === 'POST') {
      let json: any;
      try {
        json = await c.req.json();
      } catch {
        return c.text('Invalid JSON body', 400);
      }

      let con = await McpConnection.create(baseParams);

      if (con.connection) {
        c.res.headers.set('mcp-session-id', con.connection.token);
        c.res.headers.set('Metorial-Connection-Id', con.connection.id);
        c.res.headers.set('Metorial-Connection-Token', con.connection.token);
      }

      await con.handleMessage(json, {
        waitForResponse: false
      });

      return c.text('OK', 200);
    }

    return c.text('Method Not Allowed', 405);
  } else {
    if (c.req.method === 'GET') {
      if (baseParams.connectionToken) {
        return c.text('mcp-session-id header must be set for this endpoint', 400);
      }

      let con = await McpConnection.create(baseParams);

      if (con.connection) {
        c.res.headers.set('mcp-session-id', con.connection.token);
        c.res.headers.set('Metorial-Connection-Id', con.connection.id);
        c.res.headers.set('Metorial-Connection-Token', con.connection.token);
      }

      let lastMessageId = c.req.header('Last-Event-ID');

      return streamSSE(c, async stream => {
        let listenerStream = await con.listener({
          selectedChannels: 'broadcast',
          replayFromMessageId: lastMessageId
        });

        stream.onAbort(async () => {
          await listenerStream.close();
        });

        for await (let event of listenerStream.iterator()) {
          await stream.writeSSE({
            id: event.message?.id,
            data: JSON.stringify(event.mcp)
          });
        }
      });
    }

    if (c.req.method === 'POST') {
      let json: any;
      try {
        json = await c.req.json();
      } catch {
        return c.text('Invalid JSON body', 400);
      }

      let con = await McpConnection.create(baseParams);

      let res = await con.handleMessage(json, {
        waitForResponse: true
      });
      if (!res) return c.text('No response');

      if (con.connection) {
        c.res.headers.set('mcp-session-id', con.connection.token);
        c.res.headers.set('Metorial-Connection-Id', con.connection.id);
        c.res.headers.set('Metorial-Connection-Token', con.connection.token);
      }

      return streamSSE(c, async stream => {
        await stream.writeSSE({
          id: res.message?.id,
          data: JSON.stringify(res.mcp)
        });

        await delay(100); // ensure the message is sent before closing
      });

      // return c.json(res.mcp);
    }

    if (c.req.method === 'DELETE') {
      let con = await McpConnection.create(baseParams);
      await con.disableConnection();
      return c.text('OK', 200);
    }

    return c.text('Method Not Allowed', 405);
  }
});
