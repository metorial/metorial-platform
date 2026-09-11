import { Context } from '@lowerdeck/hono';
import { createConnectionHono } from '../hono';

export type PortalOAuthRouteInput = {
  portalId: string;
  magicMcpTargetId?: string;
};

export type PluginOAuthRouteInput = {
  skillPluginId: string;
};

export type PortalOAuthResolvedRoute = {
  base: string;
  projectOid: bigint;
  instanceOid: bigint;
};

export let buildOAuthProtectedResource = (base: string) => ({
  resource: `${base}`,
  authorization_servers: [base],
  bearer_methods_supported: ['header', 'query'],
  token_types_supported: ['access_token']
});

export let buildOAuthClientConfig = (base: string) => ({
  authorization_endpoint: `${base}/oauth/authorize`,
  client_id_metadata_document_supported: false,
  code_challenge_methods_supported: ['S256'],
  grant_types_supported: ['authorization_code', 'refresh_token'],
  issuer: base,
  registration_endpoint: `${base}/oauth/register`,
  response_modes_supported: ['query'],
  response_types_supported: ['code'],
  token_endpoint: `${base}/oauth/token`,
  token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post', 'none']
});

type OAuthRouteHandlers<TInput, TRoute> = {
  resolveRoute: (route: TInput, c: Context) => Promise<TRoute>;
  resolveConnectRoute?: (route: TInput, c: Context) => Promise<TRoute>;
  authorizeRoute?: (c: Context, route: TRoute) => Promise<void>;
  metadata: (d: { route: TRoute }, c: Context) => Promise<Response>;
  portal: (d: { route: TRoute }, c: Context) => Promise<Response>;
  protectedResource: (d: { route: TRoute }, c: Context) => Promise<Response>;
  openIdConfiguration: (d: { route: TRoute }, c: Context) => Promise<Response>;
  register: (d: { route: TRoute }, c: Context) => Promise<Response>;
  authorize: (d: { route: TRoute }, c: Context) => Promise<Response>;
  portalSelected?: (d: { route: TRoute }, c: Context) => Promise<Response>;
  token: (d: { route: TRoute }, c: Context) => Promise<Response>;
  registration: (
    d: { route: TRoute; registrationId: string },
    c: Context
  ) => Promise<Response>;
};

type OAuthRoutePathConfig = {
  metadata: string[];
  connect: string[];
  protectedResource: string[];
  protectedResourceMetadata: string[];
  openIdConfiguration: string[];
  register: string[];
  authorize: string[];
  portalSelected?: string[];
  token: string[];
  registration: string[];
};

let portalOAuthPaths: OAuthRoutePathConfig = {
  metadata: [
    ':portalId/:magicMcpTargetId',
    ':portalId',
    ':portalId/:magicMcpTargetId/.well-known/oauth-authorization-server',
    ':portalId/.well-known/oauth-authorization-server',
    'connect/portal/:portalId/:magicMcpTargetId',
    'connect/portal/:portalId'
  ],
  connect: [':portalId/:magicMcpTargetId', ':portalId'],
  protectedResource: [
    ':portalId/:magicMcpTargetId/.well-known/oauth-protected-resource',
    ':portalId/.well-known/oauth-protected-resource'
  ],
  protectedResourceMetadata: [':portalId/:magicMcpTargetId', ':portalId'],
  openIdConfiguration: [
    ':portalId/:magicMcpTargetId/.well-known/openid-configuration',
    ':portalId/.well-known/openid-configuration'
  ],
  register: [':portalId/:magicMcpTargetId/oauth/register', ':portalId/oauth/register'],
  authorize: [':portalId/:magicMcpTargetId/oauth/authorize', ':portalId/oauth/authorize'],
  token: [':portalId/:magicMcpTargetId/oauth/token', ':portalId/oauth/token'],
  registration: [
    ':portalId/:magicMcpTargetId/oauth/register/:registrationId',
    ':portalId/oauth/register/:registrationId'
  ]
};

let pluginOAuthPaths: OAuthRoutePathConfig = {
  metadata: [
    'connect/plugin/:skillPluginId',
    ':skillPluginId',
    ':skillPluginId/.well-known/oauth-authorization-server'
  ],
  connect: [':skillPluginId'],
  protectedResource: [':skillPluginId/.well-known/oauth-protected-resource'],
  protectedResourceMetadata: [':skillPluginId'],
  openIdConfiguration: [':skillPluginId/.well-known/openid-configuration'],
  register: [':skillPluginId/oauth/register'],
  authorize: [':skillPluginId/oauth/authorize'],
  portalSelected: [':skillPluginId/oauth/portal-selected'],
  token: [':skillPluginId/oauth/token'],
  registration: [':skillPluginId/oauth/register/:registrationId']
};

let createOAuthRouteServers = <TInput, TRoute>(d: {
  paths: OAuthRoutePathConfig;
  parseRouteInput: (c: Context) => TInput;
  handlers: OAuthRouteHandlers<TInput, TRoute>;
}) => {
  let resolveRoute = async (c: Context) =>
    await d.handlers.resolveRoute(d.parseRouteInput(c), c);
  let resolveConnectRoute = async (c: Context) => {
    let input = d.parseRouteInput(c);
    if (d.handlers.resolveConnectRoute) {
      return await d.handlers.resolveConnectRoute(input, c);
    }

    return await d.handlers.resolveRoute(input, c);
  };

  let resolveAuthorizedRoute = async (
    c: Context,
    resolver: (c: Context) => Promise<TRoute>
  ) => {
    let route = await resolver(c);
    if (d.handlers.authorizeRoute) await d.handlers.authorizeRoute(c, route);
    return route;
  };

  let withResolvedRoute =
    (
      handler: (d: { route: TRoute }, c: Context) => Promise<Response>,
      resolver: (c: Context) => Promise<TRoute> = resolveRoute
    ) =>
    async (c: Context) =>
      await handler({ route: await resolveAuthorizedRoute(c, resolver) }, c);

  let metadataServer = createConnectionHono();
  for (let path of d.paths.metadata) {
    metadataServer = metadataServer.get(path, withResolvedRoute(d.handlers.metadata));
  }

  let protectedResourceServer = createConnectionHono();
  for (let path of d.paths.protectedResourceMetadata) {
    protectedResourceServer = protectedResourceServer.get(
      path,
      withResolvedRoute(d.handlers.protectedResource)
    );
  }

  let connectServer = createConnectionHono();
  for (let path of d.paths.connect) {
    connectServer = connectServer.all(
      path,
      withResolvedRoute(d.handlers.portal, resolveConnectRoute)
    );
  }

  for (let path of d.paths.metadata) {
    connectServer = connectServer.get(path, withResolvedRoute(d.handlers.metadata));
  }

  for (let path of d.paths.protectedResource) {
    connectServer = connectServer.get(path, withResolvedRoute(d.handlers.protectedResource));
  }

  for (let path of d.paths.openIdConfiguration) {
    connectServer = connectServer.get(path, withResolvedRoute(d.handlers.openIdConfiguration));
  }

  for (let path of d.paths.register) {
    connectServer = connectServer.post(path, withResolvedRoute(d.handlers.register));
  }

  for (let path of d.paths.authorize) {
    connectServer = connectServer.get(path, withResolvedRoute(d.handlers.authorize));
  }

  if (d.handlers.portalSelected) {
    for (let path of d.paths.portalSelected ?? []) {
      connectServer = connectServer.get(path, withResolvedRoute(d.handlers.portalSelected));
    }
  }

  for (let path of d.paths.token) {
    connectServer = connectServer.post(path, withResolvedRoute(d.handlers.token));
  }

  for (let path of d.paths.registration) {
    connectServer = connectServer.get(path, async c => {
      return await d.handlers.registration(
        {
          route: await resolveAuthorizedRoute(c, resolveRoute),
          registrationId: c.req.param('registrationId')!
        },
        c
      );
    });
  }

  return {
    metadataServer,
    protectedResourceServer,
    connectServer
  };
};

export let createPortalOAuthServers = <TRoute>(
  handlers: OAuthRouteHandlers<PortalOAuthRouteInput, TRoute>
) => {
  let servers = createOAuthRouteServers({
    paths: portalOAuthPaths,
    parseRouteInput: c => {
      let portalId = c.req.param('portalId')!;
      let rawMagicMcpTargetId = c.req.param('magicMcpTargetId');

      return {
        portalId,
        magicMcpTargetId:
          typeof rawMagicMcpTargetId == 'string' && rawMagicMcpTargetId.length > 0
            ? rawMagicMcpTargetId
            : undefined
      };
    },
    handlers
  });

  return {
    metadataServer: servers.metadataServer,
    protectedResourceServer: servers.protectedResourceServer,
    connectPortalServer: servers.connectServer
  };
};

export let createPluginOAuthServers = <TRoute>(
  handlers: OAuthRouteHandlers<PluginOAuthRouteInput, TRoute>
) => {
  let servers = createOAuthRouteServers({
    paths: pluginOAuthPaths,
    parseRouteInput: c => ({ skillPluginId: c.req.param('skillPluginId')! }),
    handlers
  });

  return {
    metadataServer: servers.metadataServer,
    protectedResourceServer: servers.protectedResourceServer,
    connectPluginServer: servers.connectServer
  };
};
