import { createHono, useRequestContext } from '@metorial/hono';
import { AuthInfo } from '@metorial/module-access';
import { Authenticator } from '@metorial/rest';
import type { ServerWebSocket } from 'bun';
import { createBunWebSocket } from 'hono/bun';
import { ALL_CONNECTION_TYPES, toConnectionType } from './constants';
import { getServerSession } from './getServerSession';
import { getSessionAndAuthenticate } from './getSession';
import { mcpConnectionHandler } from './handler';

export let startMcpServer = (d: { port: number; authenticate: Authenticator<AuthInfo> }) => {
  let { upgradeWebSocket, websocket } = createBunWebSocket<ServerWebSocket>();

  let hono = createHono()
    .use(async (c, next) => {
      await next();

      c.res.headers.set('Access-Control-Allow-Origin', c.req.header('Origin') || '*');
      c.res.headers.set(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, DELETE, OPTIONS, PATCH'
      );
      c.res.headers.set(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, metorial-version'
      );
      c.res.headers.set('Access-Control-Allow-Credentials', 'true');
      c.res.headers.set('Access-Control-Max-Age', '86400');
    })
    .options('*', c => {
      return c.text('');
    })
    .get('/ping', c => c.text('OK'))
    .all('/mcp/:sessionId/:serverDeploymentId?/:connectionType?', async (c, next) => {
      let { sessionId, serverDeploymentId, connectionType: connectionTypeRaw } = c.req.param();
      let context = useRequestContext(c);

      if (
        !connectionTypeRaw &&
        serverDeploymentId &&
        ALL_CONNECTION_TYPES.has(serverDeploymentId)
      ) {
        connectionTypeRaw = sessionId;
        serverDeploymentId = undefined;
      }

      let connectionType = toConnectionType(connectionTypeRaw ?? 'sse');
      if (!connectionType) connectionType = 'sse';

      let url = new URL(c.req.url);
      let req = c.req.raw;

      let serverSessionId =
        c.req.query('metorial_server_session_id') ??
        c.req.header('mcp-session-id') ??
        c.req.header('metorial-server-session-id');

      let sessionInfo = await getSessionAndAuthenticate(sessionId, req, url, d.authenticate);
      let { serverSession, sessionCreated } = await getServerSession(
        sessionInfo,
        context,
        serverDeploymentId ?? null,
        serverSessionId ?? null,
        connectionType
      );

      return await mcpConnectionHandler(c, next, sessionInfo, serverSession, {
        connectionType,
        upgradeWebSocket,
        sessionCreated
      });
    });

  Bun.serve({
    port: d.port,
    fetch: hono.fetch,
    websocket,
    idleTimeout: 255
  });

  console.log('MCP server started on port', d.port);
};
