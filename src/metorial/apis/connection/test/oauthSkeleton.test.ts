import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let { isServiceGrantedForInstance } = vi.hoisted(() => ({
  isServiceGrantedForInstance: vi.fn()
}));

vi.mock('@metorial/module-outpost', () => ({
  outpostAccessService: { isServiceGrantedForInstance },
  outpostVerificationTokens: {},
  metorialOutpostResolver: {}
}));

import { createPortalOAuthServers } from '../src/oauth/skeleton';
import { assertOutpostOAuthRouteAccess, setOutpostAuth } from '../src/outpost';

let fakeAuth = () =>
  ({
    outpostId: 'otp_1',
    instanceId: 'oti_1',
    credentialId: 'otc_1',
    service: 'mcp_connection_proxy',
    grantedServices: ['mcp_connection_proxy'],
    requestId: 'oprq_1',
    timestamp: Math.floor(Date.now() / 1000),
    outpostChain: [],
    proxyContext: {}
  }) as any;

let buildServers = () =>
  createPortalOAuthServers({
    resolveRoute: async () => ({
      base: 'https://example.test',
      projectOid: 42n,
      instanceOid: 84n
    }),
    authorizeRoute: assertOutpostOAuthRouteAccess,
    metadata: async ({ route }, c) => c.json({ base: route.base }),
    portal: async ({ route }, c) => c.json({ base: route.base }),
    protectedResource: async ({ route }, c) => c.json({ base: route.base }),
    openIdConfiguration: async ({ route }, c) => c.json({ base: route.base }),
    register: async ({ route }, c) => c.json({ base: route.base }),
    authorize: async ({ route }, c) => c.json({ base: route.base }),
    token: async ({ route }, c) => c.json({ base: route.base }),
    registration: async ({ route }, c) => c.json({ base: route.base })
  });

describe('createOAuthRouteServers (via createPortalOAuthServers) instance gating', () => {
  beforeEach(() => {
    isServiceGrantedForInstance.mockReset();
  });

  it('lets a direct (non-outpost) request through untouched', async () => {
    let { metadataServer } = buildServers();

    let res = await metadataServer.request('http://test/portal_1');

    expect(res.status).toBe(200);
    expect(isServiceGrantedForInstance).not.toHaveBeenCalled();
  });

  // In production, `outpostConnectionAuthMiddleware` runs on the *parent* app before it
  // delegates into a `.route()`-mounted sub-app (see `connectApi`/`startMcpServer`) -- Hono
  // shares the same Context across that mount boundary, so `c.set`/`c.get` carry through. This
  // mounts the built server the same way to exercise that boundary faithfully.
  let mount = (sub: { fetch: typeof Hono.prototype.fetch }) =>
    new Hono()
      .use('*', async (c, next) => {
        setOutpostAuth(c, fakeAuth());
        return next();
      })
      .route('/', sub as any);

  it('lets an outpost-authenticated request through when the instance is granted', async () => {
    isServiceGrantedForInstance.mockResolvedValue(true);
    let { metadataServer } = buildServers();

    let res = await mount(metadataServer).request('http://test/portal_1');

    expect(res.status).toBe(200);
    expect(isServiceGrantedForInstance).toHaveBeenCalledWith({
      outpostId: 'otp_1',
      projectOid: 42n,
      instanceOid: 84n,
      service: 'mcp_connection_proxy'
    });
  });

  it('rejects an outpost-authenticated request when the instance is not granted', async () => {
    isServiceGrantedForInstance.mockResolvedValue(false);
    let { metadataServer } = buildServers();

    let res = await mount(metadataServer).request('http://test/portal_1');

    expect(res.status).toBe(403);
  });

  it('does not consult outpost access unless authorizeRoute is wired (global-router path)', async () => {
    isServiceGrantedForInstance.mockResolvedValue(false);
    let { metadataServer } = createPortalOAuthServers({
      resolveRoute: async () => ({
        base: 'https://example.test',
        host: 'region.example'
      }),
      metadata: async ({ route }, c) => c.json({ base: route.base }),
      portal: async ({ route }, c) => c.json({ base: route.base }),
      protectedResource: async ({ route }, c) => c.json({ base: route.base }),
      openIdConfiguration: async ({ route }, c) => c.json({ base: route.base }),
      register: async ({ route }, c) => c.json({ base: route.base }),
      authorize: async ({ route }, c) => c.json({ base: route.base }),
      token: async ({ route }, c) => c.json({ base: route.base }),
      registration: async ({ route }, c) => c.json({ base: route.base })
    });

    let res = await mount(metadataServer).request('http://test/portal_1');

    expect(res.status).toBe(200);
    expect(isServiceGrantedForInstance).not.toHaveBeenCalled();
  });

  it('also gates the registration lookup route, which resolves the route outside of withResolvedRoute', async () => {
    isServiceGrantedForInstance.mockResolvedValue(false);
    let { connectPortalServer } = buildServers();

    let res = await mount(connectPortalServer).request(
      'http://test/portal_1/oauth/register/reg_1'
    );

    expect(res.status).toBe(403);
  });
});
