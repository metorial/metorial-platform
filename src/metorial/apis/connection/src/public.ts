import { isServiceError } from '@lowerdeck/error';
import { createExecutionContext, provideExecutionContext } from '@lowerdeck/execution-context';
import { Context } from '@lowerdeck/hono';
import {
  getPublicMcpBindingCookieName,
  isPublicMcpOAuthError,
  presentClientRegistration,
  PUBLIC_MCP_SCOPE,
  createPublicMcpGrantAccess,
  PublicMcpOAuthError,
  type PublicMcpOAuthErrorCode,
  type PublicMcpRoute,
  publicMcpRouteService,
  publicMcpServerAuthorizationService,
  publicMcpServerClientService,
  publicMcpServerGrantService,
  publicMcpServerTokenService
} from '@metorial-subspace/module-public-mcp';
import { getConfig } from '@metorial/config';
import { db } from '@metorial/db';
import { generateSnowflakeId } from '@metorial/id';
import { getCookie } from 'hono/cookie';
import { handleMcpRequest } from './mcp';
import {
  buildOAuthClientConfig,
  createPublicMcpServers,
  PublicMcpRouteInput
} from './oauth/skeleton';
import { getClientCredentialsFromBasicAuth, getString, parseOAuthBody } from './oauth/utils';
import { getOutpostAuth, resolveOutpostOrigin, useConnectionRequestContext } from './outpost';

export let PUBLIC_MCP_ORIGIN_HEADER = 'Metorial-Public-Mcp-Origin';
export let PUBLIC_MCP_MISS_HEADER = 'Metorial-Public-Mcp-Miss';
let NAMESPACE_HOST_HEADER = 'Metorial-Namespace-Host';

type ResolvedPublicMcpRoute = {
  route: PublicMcpRoute;
  base: string;
  validBaseUrls: string[];
};

type ErrorMode = 'json' | 'browser' | 'mcp';

class PublicMcpRouteNotFound extends Error {
  // A miss tells the edge its cached slug -> cell mapping may be stale.
  constructor(readonly isRoutingMiss: boolean) {
    super('Public MCP server not found');
  }
}

let trimSlash = (value: string) => value.replace(/\/+$/, '');

let resolvePublicRoute = async (
  input: PublicMcpRouteInput,
  c: Context
): Promise<ResolvedPublicMcpRoute> => {
  let route = await publicMcpRouteService.resolveSlug({ slug: input.slug });
  if (!route) throw new PublicMcpRouteNotFound(true);

  let urls = getConfig().urls;
  let apiOrigin = trimSlash(resolveOutpostOrigin(getOutpostAuth(c)) ?? urls.apiUrl);
  let apiBase = `${apiOrigin}/connect/public/${route.slug}`;
  let proxyBase = urls.publicMcpUrl ? `${urls.publicMcpUrl}/${route.slug}` : null;

  let base = apiBase;
  let requestOrigin = c.req.header(PUBLIC_MCP_ORIGIN_HEADER);
  let namespaceHost = c.req.header(NAMESPACE_HOST_HEADER);

  if (proxyBase && requestOrigin && trimSlash(requestOrigin) === urls.publicMcpUrl) {
    base = proxyBase;
  } else if (namespaceHost) {
    let allowed = await publicMcpRouteService.isNamespaceHostAllowed({
      publicMcpServer: route,
      namespaceHost
    });
    if (!allowed) throw new PublicMcpRouteNotFound(false);

    base = `https://${namespaceHost}/connect/public/${route.slug}`;
  }

  return {
    route,
    base,
    validBaseUrls: [...new Set([base, apiBase, ...(proxyBase ? [proxyBase] : [])])]
  };
};

let resourceMetadataUrl = (base: string) => {
  let url = new URL(base);
  return `${url.origin}/.well-known/oauth-protected-resource${url.pathname}`;
};

let escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

let renderPage = (c: Context, d: { title: string; body: string; status?: number }) =>
  c.html(
    `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<title>${escapeHtml(d.title)}</title>
<style>
body{font-family:system-ui,-apple-system,sans-serif;background:#f6f6f7;color:#111;margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center}
main{background:#fff;border:1px solid #e4e4e7;border-radius:12px;padding:32px;max-width:440px;width:100%;box-sizing:border-box}
h1{font-size:20px;margin:0 0 12px}
p{color:#52525b;line-height:1.5;margin:0 0 12px}
.actions{display:flex;gap:12px;margin-top:24px}
a.button{flex:1;text-align:center;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:500}
a.primary{background:#111;color:#fff}
a.secondary{background:#f4f4f5;color:#111}
</style>
</head>
<body><main>${d.body}</main></body>
</html>`,
    (d.status ?? 200) as any,
    {
      'Cache-Control': 'no-store',
      'Content-Security-Policy':
        "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'",
      'X-Frame-Options': 'DENY'
    }
  );

let toOAuthError = (e: unknown) => {
  if (isPublicMcpOAuthError(e)) return e;

  if (isServiceError(e)) {
    let res = e.toResponse();
    if (res.oauth) {
      return new PublicMcpOAuthError(
        res.oauth.error as PublicMcpOAuthErrorCode,
        res.oauth.errorMessage ?? res.message,
        { status: e.data.status }
      );
    }
  }

  return null;
};

let renderError = (
  c: Context,
  e: unknown,
  mode: ErrorMode,
  resolved: ResolvedPublicMcpRoute | null
) => {
  if (e instanceof PublicMcpRouteNotFound) {
    return c.json(
      { error: 'not_found', error_description: 'Server not found' },
      404,
      e.isRoutingMiss ? { [PUBLIC_MCP_MISS_HEADER]: '1' } : {}
    );
  }

  let oauthError = toOAuthError(e);
  if (!oauthError) throw e;

  if (mode === 'browser') {
    let redirectUrl = oauthError.toRedirectUrl();
    if (redirectUrl) return c.redirect(redirectUrl, 302);

    return renderPage(c, {
      title: 'Unable to connect',
      status: oauthError.status,
      body: `<h1>Unable to connect</h1><p>${escapeHtml(oauthError.description)}</p>`
    });
  }

  let headers: Record<string, string> = { 'Cache-Control': 'no-store' };
  if (mode === 'mcp' && oauthError.error === 'invalid_token' && resolved) {
    headers['WWW-Authenticate'] =
      `Bearer realm="OAuth", resource_metadata="${resourceMetadataUrl(resolved.base)}", error="invalid_token", error_description="${oauthError.description.replace(/"/g, "'")}"`;
  }

  return c.json(oauthError.toJSON(), oauthError.status as any, headers);
};

let withPublicRoute = async (
  c: Context,
  input: PublicMcpRouteInput,
  mode: ErrorMode,
  handler: (resolved: ResolvedPublicMcpRoute) => Promise<Response>
) => {
  let resolved: ResolvedPublicMcpRoute | null = null;

  try {
    resolved = await resolvePublicRoute(input, c);
    return await handler(resolved);
  } catch (e) {
    return renderError(c, e, mode, resolved);
  }
};

let getRequestContext = (c: Context) => {
  let { ip, ua } = useConnectionRequestContext(c);
  return { ip, ua: ua ?? null };
};

let getBearerToken = (c: Context) => {
  let authorization = c.req.header('authorization');
  if (!authorization?.toLowerCase().startsWith('bearer ')) return null;
  return authorization.slice('bearer '.length).trim() || null;
};

let getTokenCredentials = (c: Context, body: Record<string, string>) => {
  let basic = getClientCredentialsFromBasicAuth(c);
  let bodyClientId = getString(body.client_id) ?? null;
  let bodySecret = getString(body.client_secret) ?? null;

  if (basic) {
    if (bodyClientId && bodyClientId !== basic.clientId) {
      throw new PublicMcpOAuthError('invalid_client', 'Conflicting client credentials', {
        status: 401
      });
    }

    return {
      clientId: basic.clientId,
      clientSecret: basic.clientSecret,
      method: 'client_secret_basic' as const
    };
  }

  return {
    clientId: bodyClientId,
    clientSecret: bodySecret,
    method: bodySecret ? ('client_secret_post' as const) : ('none' as const)
  };
};

let bindingCookieHeader = (cookie: { name: string; value: string; maxAgeSeconds: number }) =>
  `${cookie.name}=${cookie.value}; Path=/; Max-Age=${cookie.maxAgeSeconds}; HttpOnly; Secure; SameSite=Lax`;

let buildAuthorizationServerMetadata = (base: string) => ({
  ...buildOAuthClientConfig(base),
  revocation_endpoint: `${base}/oauth/revoke`,
  revocation_endpoint_auth_methods_supported: [
    'client_secret_basic',
    'client_secret_post',
    'none'
  ],
  scopes_supported: [PUBLIC_MCP_SCOPE],
  authorization_response_iss_parameter_supported: true
});

let metadataHeaders = { 'Cache-Control': 'public, max-age=300' };

export let createPublicMcpHandler = () =>
  createPublicMcpServers<PublicMcpRouteInput>({
    resolveRoute: async input => input,

    protectedResource: async ({ route }, c) =>
      withPublicRoute(c, route, 'json', async ({ route: server, base }) =>
        c.json(
          {
            resource: base,
            resource_name: server.name,
            authorization_servers: [base],
            bearer_methods_supported: ['header'],
            scopes_supported: [PUBLIC_MCP_SCOPE]
          },
          200,
          metadataHeaders
        )
      ),

    metadata: async ({ route }, c) =>
      withPublicRoute(c, route, 'json', async ({ base }) =>
        c.json(buildAuthorizationServerMetadata(base), 200, metadataHeaders)
      ),

    openIdConfiguration: async ({ route }, c) =>
      withPublicRoute(c, route, 'json', async ({ base }) =>
        c.json(buildAuthorizationServerMetadata(base), 200, metadataHeaders)
      ),

    register: async ({ route }, c) =>
      withPublicRoute(c, route, 'json', async ({ route: server, base }) => {
        let body: Record<string, unknown>;
        try {
          body = await c.req.json();
        } catch {
          throw new PublicMcpOAuthError(
            'invalid_client_metadata',
            'Request body must be a JSON object'
          );
        }
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
          throw new PublicMcpOAuthError(
            'invalid_client_metadata',
            'Request body must be a JSON object'
          );
        }

        let registered = await publicMcpServerClientService.registerClient({
          publicMcpServer: server,
          input: body,
          context: getRequestContext(c)
        });

        return c.json(
          presentClientRegistration({
            client: registered.client,
            clientSecret: registered.clientSecret,
            registrationAccessToken: registered.registrationAccessToken,
            registrationClientUri: `${base}/oauth/register/${registered.client.clientId}`
          }),
          201,
          { 'Cache-Control': 'no-store' }
        );
      }),

    registration: async ({ route, clientId }, c) =>
      withPublicRoute(c, route, 'json', async ({ route: server, base }) => {
        let client = await publicMcpServerClientService.getClientRegistration({
          publicMcpServer: server,
          clientId,
          registrationAccessToken: getBearerToken(c)
        });

        return c.json(
          presentClientRegistration({
            client,
            registrationClientUri: `${base}/oauth/register/${client.clientId}`
          }),
          200,
          { 'Cache-Control': 'no-store' }
        );
      }),

    authorize: async ({ route }, c) =>
      withPublicRoute(c, route, 'browser', async ({ route: server, base }) => {
        let result = await publicMcpServerAuthorizationService.authorize({
          route: server,
          baseUrl: base,
          query: {
            clientId: c.req.query('client_id') ?? null,
            redirectUri: c.req.query('redirect_uri') ?? null,
            responseType: c.req.query('response_type') ?? null,
            codeChallenge: c.req.query('code_challenge') ?? null,
            codeChallengeMethod: c.req.query('code_challenge_method') ?? null,
            state: c.req.query('state') ?? null,
            scope: c.req.query('scope') ?? null,
            resource: c.req.query('resource') ?? null
          },
          context: getRequestContext(c)
        });

        c.header('Set-Cookie', bindingCookieHeader(result.bindingCookie));

        if (result.type === 'redirect') {
          c.header('Cache-Control', 'no-store');
          return c.redirect(result.url, 302);
        }

        return renderPage(c, {
          title: `Connect ${result.serverName}`,
          body: `<h1>Connect to ${escapeHtml(result.serverName)}</h1>
<p><strong>${escapeHtml(result.clientName)}</strong> is requesting access to ${escapeHtml(result.serverName)}${
            result.organizationName
              ? ` by <strong>${escapeHtml(result.organizationName)}</strong>`
              : ''
          }.</p>
<p>After you continue, you will be redirected to <strong>${escapeHtml(result.redirectHost)}</strong>. Only continue if you trust this application.</p>
<div class="actions"><a class="button secondary" href="${escapeHtml(result.denyUrl)}">Deny</a><a class="button primary" href="${escapeHtml(result.completeUrl)}">Continue</a></div>`
        });
      }),

    complete: async ({ route, authorizationId }, c) =>
      withPublicRoute(c, route, 'browser', async ({ route: server }) => {
        let result = await publicMcpServerAuthorizationService.complete({
          route: server,
          authorizationId,
          bindingNonce: getCookie(c, getPublicMcpBindingCookieName(authorizationId)) ?? null,
          deny: c.req.query('deny') === '1',
          context: getRequestContext(c)
        });

        c.header('Cache-Control', 'no-store');
        return c.redirect(result.url, 302);
      }),

    token: async ({ route }, c) =>
      withPublicRoute(c, route, 'json', async ({ route: server, validBaseUrls }) => {
        let body = await parseOAuthBody(c);

        let response = await publicMcpServerTokenService.exchange({
          route: server,
          validBaseUrls,
          input: {
            grantType: getString(body.grant_type) ?? null,
            code: getString(body.code) ?? null,
            redirectUri: getString(body.redirect_uri) ?? null,
            codeVerifier: getString(body.code_verifier) ?? null,
            refreshToken: getString(body.refresh_token) ?? null,
            resource: getString(body.resource) ?? null
          },
          credentials: getTokenCredentials(c, body),
          context: getRequestContext(c)
        });

        return c.json(response, 200, { 'Cache-Control': 'no-store', Pragma: 'no-cache' });
      }),

    revoke: async ({ route }, c) =>
      withPublicRoute(c, route, 'json', async ({ route: server }) => {
        let body = await parseOAuthBody(c);

        await publicMcpServerTokenService.revoke({
          route: server,
          token: getString(body.token) ?? null,
          credentials: getTokenCredentials(c, body),
          context: getRequestContext(c)
        });

        return c.body(null, 200, { 'Cache-Control': 'no-store' });
      }),

    mcp: async ({ route }, c) =>
      withPublicRoute(c, route, 'mcp', async ({ route: server, base }) => {
        let grant = await publicMcpServerTokenService.authenticateAccessToken({
          route: server,
          token: getBearerToken(c)
        });

        await publicMcpServerGrantService.recordUse({ grant, context: getRequestContext(c) });

        let session = await publicMcpServerGrantService.ensureGrantSession({ grant });

        let instance = await db.instance.findUniqueOrThrow({
          where: { oid: server.instanceOid }
        });

        let context = getRequestContext(c);

        return await provideExecutionContext(
          createExecutionContext({
            userAgent: context.ua ?? 'unknown',
            ip: context.ip,
            contextId: generateSnowflakeId('mreq'),
            type: 'request'
          }),
          async () =>
            await handleMcpRequest(c, {
              instance,
              sessionId: session.id,
              agentClient: {
                type: 'mcp_client_oauth',
                name: grant.client.clientName,
                oauthRegistrationId: grant.client.id,
                foreignId: grant.client.clientId
              },
              publicBaseUrl: base,
              publicMcpAccess: createPublicMcpGrantAccess({ grant, sessionOid: session.oid })
            })
        );
      })
  });
