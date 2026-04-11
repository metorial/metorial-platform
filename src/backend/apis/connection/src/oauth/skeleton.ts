import { getConfig } from '@metorial/config';
import { Context } from 'hono';
import { createOAuthHono } from './hono';

export type PortalOAuthRouteInput = {
  portalId: string;
  magicMcpTargetId?: string;
};

export type PortalOAuthResolvedRoute = {
  base: string;
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
  issuer: getConfig().urls.apiUrl,
  registration_endpoint: `${base}/oauth/register`,
  response_modes_supported: ['query'],
  response_types_supported: ['code'],
  token_endpoint: `${base}/oauth/token`,
  token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post', 'none']
});

let metadataPaths = [
  ':portalId/:magicMcpTargetId',
  ':portalId',
  'connect/portal/:portalId/:magicMcpTargetId',
  'connect/portal/:portalId'
];

let connectPortalPaths = [':portalId/:magicMcpTargetId', ':portalId'];
let protectedResourcePaths = [
  ':portalId/:magicMcpTargetId/.well-known/oauth-protected-resource',
  ':portalId/.well-known/oauth-protected-resource'
];
let openIdConfigurationPaths = [
  ':portalId/:magicMcpTargetId/.well-known/openid-configuration',
  ':portalId/.well-known/openid-configuration'
];
let registerPaths = [':portalId/:magicMcpTargetId/oauth/register', ':portalId/oauth/register'];
let authorizePaths = [
  ':portalId/:magicMcpTargetId/oauth/authorize',
  ':portalId/oauth/authorize'
];
let tokenPaths = [':portalId/:magicMcpTargetId/oauth/token', ':portalId/oauth/token'];
let registrationPaths = [
  ':portalId/:magicMcpTargetId/oauth/register/:registrationId',
  ':portalId/oauth/register/:registrationId'
];

export let createPortalOAuthServers = <TRoute>(d: {
  resolveRoute: (route: PortalOAuthRouteInput) => Promise<TRoute>;
  metadata: (d: { route: TRoute }, c: Context) => Promise<Response>;
  portal: (d: { route: TRoute }, c: Context) => Promise<Response>;
  protectedResource: (d: { route: TRoute }, c: Context) => Promise<Response>;
  openIdConfiguration: (d: { route: TRoute }, c: Context) => Promise<Response>;
  register: (d: { route: TRoute }, c: Context) => Promise<Response>;
  authorize: (d: { route: TRoute }, c: Context) => Promise<Response>;
  token: (d: { route: TRoute }, c: Context) => Promise<Response>;
  registration: (
    d: { route: TRoute; registrationId: string },
    c: Context
  ) => Promise<Response>;
}) => {
  let resolveRoute = async (c: Context) => {
    let portalId = c.req.param('portalId');
    let rawMagicMcpTargetId = c.req.param('magicMcpTargetId');

    return await d.resolveRoute({
      portalId,
      magicMcpTargetId:
        typeof rawMagicMcpTargetId == 'string' && rawMagicMcpTargetId.length > 0
          ? rawMagicMcpTargetId
          : undefined
    });
  };

  let metadataServer = createOAuthHono();
  for (let path of metadataPaths) {
    metadataServer = metadataServer.get(path, async c => {
      return await d.metadata(
        {
          route: await resolveRoute(c)
        },
        c
      );
    });
  }

  let connectPortalServer = createOAuthHono();

  for (let path of connectPortalPaths) {
    connectPortalServer = connectPortalServer.all(path, async c => {
      return await d.portal(
        {
          route: await resolveRoute(c)
        },
        c
      );
    });
  }

  for (let path of protectedResourcePaths) {
    connectPortalServer = connectPortalServer.get(path, async c => {
      return await d.protectedResource(
        {
          route: await resolveRoute(c)
        },
        c
      );
    });
  }

  for (let path of openIdConfigurationPaths) {
    connectPortalServer = connectPortalServer.get(path, async c => {
      return await d.openIdConfiguration(
        {
          route: await resolveRoute(c)
        },
        c
      );
    });
  }

  for (let path of registerPaths) {
    connectPortalServer = connectPortalServer.post(path, async c => {
      return await d.register(
        {
          route: await resolveRoute(c)
        },
        c
      );
    });
  }

  for (let path of authorizePaths) {
    connectPortalServer = connectPortalServer.get(path, async c => {
      return await d.authorize(
        {
          route: await resolveRoute(c)
        },
        c
      );
    });
  }

  for (let path of tokenPaths) {
    connectPortalServer = connectPortalServer.post(path, async c => {
      return await d.token(
        {
          route: await resolveRoute(c)
        },
        c
      );
    });
  }

  for (let path of registrationPaths) {
    connectPortalServer = connectPortalServer.get(path, async c => {
      return await d.registration(
        {
          route: await resolveRoute(c),
          registrationId: c.req.param('registrationId')!
        },
        c
      );
    });
  }

  return {
    metadataServer,
    connectPortalServer
  };
};
