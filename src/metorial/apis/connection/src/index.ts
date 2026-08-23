import { createExecutionContext, provideExecutionContext } from '@lowerdeck/execution-context';
import { useRequestContext } from '@lowerdeck/hono';
import { generateSnowflakeId } from '@metorial/id';
import { AuthInfo } from '@metorial/module-access';
import { Authenticator } from '@metorial/rest';
import { authenticateAndResolveInstance } from './getSession';
import { createConnectionHono } from './hono';
import { handleMagicMcpRequest } from './magic';
import { handleMcpRequest } from './mcp';

export let startMcpServer = (d: { port: number; authenticate: Authenticator<AuthInfo> }) => {
  let hono = createConnectionHono()
    .use(async (c, next) => {
      await next();

      c.res.headers.set('Access-Control-Allow-Origin', c.req.header('Origin') || '*');
      c.res.headers.set(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, DELETE, OPTIONS, PATCH'
      );
      c.res.headers.set(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, metorial-version, mcp-protocol-version, MCP-Session-ID, Last-Event-ID, baggage, sentry-trace'
      );
      c.res.headers.set(
        'Access-Control-Expose-Headers',
        'Metorial-Connection-Id, Metorial-Connection-Token, Metorial-Session-Id, MCP-Session-ID'
      );
      c.res.headers.set('Access-Control-Allow-Credentials', 'true');
      c.res.headers.set('Access-Control-Max-Age', '86400');
    })
    .options('*', c => {
      return c.text('');
    })
    .get('/ping', c => c.text('OK'))
    .all('/connect/mcp/:sessionId', async (c, _next) => {
      let { sessionId } = c.req.param();
      let context = useRequestContext(c);
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
          let { instance } = await authenticateAndResolveInstance(req, url, d.authenticate);
          return handleMcpRequest(c, {
            instance,
            sessionId,
            enforceIngressNetworkPolicy: true,
            ingressIp: context.ip
          });
        }
      );
    })
    .all('/connect/magic/:magicMcpServerId', async (c, _next) => {
      let { magicMcpServerId } = c.req.param();
      return handleMagicMcpRequest({
        c,
        magicMcpTargetIdOrAlias: magicMcpServerId,
        authenticate: d.authenticate
      });
    });

  Bun.serve({
    port: d.port,
    fetch: hono.fetch,
    idleTimeout: 255
  });

  console.log('MCP server started on port', d.port);
};

export { authenticateAndResolveInstance } from './getSession';
export { handleMagicMcpRequest } from './magic';
export { handleMcpRequest } from './mcp';
export * from './portal';
