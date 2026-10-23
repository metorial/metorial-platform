import { isLocalDevelopmentOrigin } from '@lowerdeck/cors';
import { createExecutionContext, provideExecutionContext } from '@lowerdeck/execution-context';
import { generateSnowflakeId } from '@metorial/id';
import { assertCanUseSessionById } from '@metorial-subspace/module-tenant';
import { AuthInfo } from '@metorial/module-access';
import { Authenticator } from '@metorial/rest';
import { authenticateAndResolveInstance } from './getSession';
import { createConnectionHono } from './hono';
import { handleMagicMcpRequest } from './magic';
import { handleMcpRequest } from './mcp';
import { outpostConnectionAuthMiddleware, useConnectionRequestContext } from './outpost';
import { createPublicMcpHandler } from './public';

let CORS_ALLOW_HEADERS =
  'Content-Type, Authorization, metorial-version, mcp-protocol-version, Mcp-Method, Mcp-Name, MCP-Session-ID, Last-Event-ID, baggage, sentry-trace';
let CORS_EXPOSE_HEADERS =
  'Metorial-Connection-Id, Metorial-Connection-Token, Metorial-Session-Id, MCP-Session-ID, MCP-Protocol-Version';

export type CorsOriginOption = string[] | ((origin: string) => boolean);

let isCorsOriginAllowed = (origin: string | undefined, corsOrigins?: CorsOriginOption) => {
  if (!origin) return false;
  if (!corsOrigins || isLocalDevelopmentOrigin(origin)) return true;
  return typeof corsOrigins === 'function'
    ? corsOrigins(origin)
    : corsOrigins.includes(origin);
};

export let startMcpServer = (d: {
  port: number;
  authenticate: Authenticator<AuthInfo>;
  /** Origins allowed to call this MCP server from a browser. Unset allows all. */
  corsOrigins?: CorsOriginOption;
}) => {
  let publicHandler = createPublicMcpHandler();

  let hono = createConnectionHono()
    .use(outpostConnectionAuthMiddleware)
    .use(async (c, next) => {
      await next();

      let origin = c.req.header('Origin');
      if (!isCorsOriginAllowed(origin, d.corsOrigins)) return;

      c.res.headers.set('Access-Control-Allow-Origin', origin!);
      c.res.headers.set('Vary', 'Origin');
      c.res.headers.set(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, DELETE, OPTIONS, PATCH'
      );
      c.res.headers.set(
        'Access-Control-Allow-Headers',
        c.req.header('Access-Control-Request-Headers') ?? CORS_ALLOW_HEADERS
      );
      c.res.headers.set('Access-Control-Expose-Headers', CORS_EXPOSE_HEADERS);
      c.res.headers.set('Access-Control-Allow-Credentials', 'true');
      c.res.headers.set('Access-Control-Max-Age', '86400');
    })
    .options('*', c => {
      return c.body(null, 204);
    })
    .get('/ping', c => c.text('OK'))
    .all('/connect/mcp/:sessionId', async (c, _next) => {
      let { sessionId } = c.req.param();
      let context = useConnectionRequestContext(c);
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
          let { instance, organizationActor } = await authenticateAndResolveInstance(
            req,
            url,
            d.authenticate
          );
          await assertCanUseSessionById({ instance, organizationActor, sessionId });

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
    })
    .route('/connect/public', publicHandler.connectPublicServer)
    .route(
      '/.well-known/oauth-protected-resource/connect/public',
      publicHandler.protectedResourceServer
    )
    .route(
      '/.well-known/oauth-authorization-server/connect/public',
      publicHandler.metadataServer
    )
    .route(
      '/.well-known/openid-configuration/connect/public',
      publicHandler.openIdConfigurationServer
    );

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
export * from './outpost';
export * from './portal';
export * from './public';
