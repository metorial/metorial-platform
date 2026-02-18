import { createExecutionContext, provideExecutionContext } from '@metorial/execution-context';
import { createHono, useRequestContext } from '@metorial/hono';
import { generateSnowflakeId } from '@metorial/id';
import { AuthInfo } from '@metorial/module-access';
import { Authenticator } from '@metorial/rest';
import { authenticateAndResolveInstance } from './getSession';
import { mcpProxyHandler } from './handler';

export let startMcpServer = (d: { port: number; authenticate: Authenticator<AuthInfo> }) => {
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
    .all('/mcp/:sessionId/:connectionType?', async (c, _next) => {
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
          return mcpProxyHandler(c, instance, sessionId);
        }
      );
    });

  Bun.serve({
    port: d.port,
    fetch: hono.fetch,
    idleTimeout: 255
  });

  console.log('MCP server started on port', d.port);
};
