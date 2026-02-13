import { createExecutionContext, provideExecutionContext } from '@metorial/execution-context';
import { createHono, useRequestContext } from '@metorial/hono';
import { generateSnowflakeId } from '@metorial/id';
import { AuthInfo } from '@metorial/module-access';
import { Authenticator } from '@metorial/rest';
import type { ServerWebSocket } from 'bun';
import { createBunWebSocket } from 'hono/bun';
import { ALL_CONNECTION_TYPES, toConnectionType } from './constants';
import { getServerSession } from './getServerSession';
import { getSessionAndAuthenticate } from './getSession';
import { mcpConnectionHandler } from './handler';
import { proxyMagicMcpRequestToSubspace } from './subspaceProxy';

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
        'Content-Type, Authorization, metorial-version, mcp-protocol-version, mcp-session-id, last-event-id'
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
        connectionTypeRaw = serverDeploymentId;
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

      return provideExecutionContext(
        createExecutionContext({
          userAgent: context.ua ?? 'unknown',
          ip: context.ip,
          contextId: generateSnowflakeId('mreq'),
          type: 'request'
        }),
        async () => {
          let sessionInfo = await getSessionAndAuthenticate(
            {
              type: 'session',
              sessionId
            },
            req,
            url,
            d.authenticate,
            context
          );
          if (sessionInfo.type === 'magic_mcp_subspace_session') {
            return await proxyMagicMcpRequestToSubspace(c, sessionInfo, connectionType);
          }

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
        }
      );
    })
    .all('/magic/:magicMcpServerId/:connectionType', async (c, next) => {
      let { magicMcpServerId, connectionType: connectionTypeRaw } = c.req.param();
      let context = useRequestContext(c);

      let connectionType = toConnectionType(connectionTypeRaw ?? 'sse');
      if (!connectionType) connectionType = 'sse';

      let url = new URL(c.req.url);
      let req = c.req.raw;

      return provideExecutionContext(
        createExecutionContext({
          userAgent: context.ua ?? 'unknown',
          ip: context.ip,
          contextId: generateSnowflakeId('mreq'),
          type: 'request'
        }),
        async () => {
          let sessionInfo = await getSessionAndAuthenticate(
            {
              type: 'magic_mcp_server',
              magicMcpServerId
            },
            req,
            url,
            d.authenticate,
            context
          );
          if (sessionInfo.type !== 'magic_mcp_subspace_session') {
            throw new Error('Magic MCP route requires Subspace-backed session info');
          }

          return await proxyMagicMcpRequestToSubspace(c, sessionInfo, connectionType);
        }
      );
    });

  Bun.serve({
    port: d.port,
    fetch: hono.fetch,
    websocket,
    idleTimeout: 255
  });

  console.log('MCP server started on port', d.port);
};
