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
import { mcpConnectionHandler, providerMcpConnectionHandler } from './handler';

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
        'Content-Type, Authorization, metorial-version, mcp-protocol-version'
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
              sessionId,
              providerDeploymentId: serverDeploymentId
            },
            req,
            url,
            d.authenticate,
            context
          );
          let serverSessionResult = await getServerSession(
            sessionInfo,
            context,
            serverDeploymentId ?? null,
            serverSessionId ?? null,
            connectionType
          );

          if (
            serverSessionResult.type === 'provider' &&
            sessionInfo.type === 'subspace_session_client_secret'
          ) {
            return await providerMcpConnectionHandler(c, next, sessionInfo, serverSessionResult, {
              connectionType
            });
          }

          if (serverSessionResult.type === 'legacy') {
            return await mcpConnectionHandler(
              c,
              next,
              sessionInfo,
              serverSessionResult.serverSession,
              {
                connectionType,
                upgradeWebSocket,
                sessionCreated: serverSessionResult.sessionCreated
              }
            );
          }

          throw new Error('Invalid session state');
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
