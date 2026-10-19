import { Service } from '@lowerdeck/service';
import { db, getId, withTransaction } from '@metorial-subspace/db';
import { providerSetupSessionService } from '@metorial-subspace/module-auth';
import {
  getSubspaceSystemProviderEventBase,
  metorialDb
} from '@metorial-subspace/module-tenant';
import { Fabric } from '@metorial/fabric';
import { addMinutes } from 'date-fns';
import { env } from '../env';
import { assertPublicMcpRateLimit } from '../internal/rateLimit';
import {
  PUBLIC_MCP_AUTHORIZATION_CODE_TTL_MINUTES,
  PUBLIC_MCP_AUTHORIZATION_TTL_MINUTES,
  PUBLIC_MCP_BINDING_COOKIE_PREFIX,
  PUBLIC_MCP_RATE_LIMITS,
  PUBLIC_MCP_SCOPE
} from '../lib/constants';
import { withPublicMcpGrantCapacity } from '../lib/capacityLock';
import { PublicMcpOAuthError } from '../lib/oauthError';
import { generateSecret, hashSecret, secretsEqual } from '../lib/secrets';
import type { PublicMcpRoute } from './publicMcpRoute';
import { publicMcpServerClientService } from './publicMcpServerClient';
import { publicMcpServerGrantService } from './publicMcpServerGrant';

let AUTHORIZATION_CODE_PREFIX = 'metorial_pmac_';

let codeChallengePattern = /^[A-Za-z0-9_-]{43}$/;

let normalizeResource = (value: string) => value.replace(/\/+$/, '');

export let getPublicMcpBindingCookieName = (authorizationId: string) =>
  `${PUBLIC_MCP_BINDING_COOKIE_PREFIX}${authorizationId}`;

let setupSessionUrl = (setupSession: { id: string; clientSecret: string }) =>
  `${env.service.INTEGRATIONS_UI_URL.replace(/\/+$/, '')}/setup-session/${setupSession.id}?client_secret=${setupSession.clientSecret}`;

let completionUrl = (d: { baseUrl: string; authorizationId: string }) =>
  `${d.baseUrl}/oauth/complete/${d.authorizationId}`;

let redirectWithCode = (d: {
  redirectUri: string;
  code: string;
  state: string | null;
  issuer: string;
}) => {
  let url = new URL(d.redirectUri);
  url.searchParams.set('code', d.code);
  if (d.state) url.searchParams.set('state', d.state);
  url.searchParams.set('iss', d.issuer);
  return url.toString();
};

export type PublicMcpAuthorizeQuery = {
  clientId: string | null;
  redirectUri: string | null;
  responseType: string | null;
  codeChallenge: string | null;
  codeChallengeMethod: string | null;
  state: string | null;
  scope: string | null;
  resource: string | null;
};

export type PublicMcpAuthorizeResult =
  | {
      type: 'redirect';
      url: string;
      bindingCookie: { name: string; value: string; maxAgeSeconds: number };
    }
  | {
      type: 'consent';
      completeUrl: string;
      denyUrl: string;
      serverName: string;
      organizationName: string | null;
      clientName: string;
      redirectHost: string;
      bindingCookie: { name: string; value: string; maxAgeSeconds: number };
    };

class publicMcpServerAuthorizationServiceImpl {
  async authorize(d: {
    route: PublicMcpRoute;
    baseUrl: string;
    query: PublicMcpAuthorizeQuery;
    context: { ip: string; ua: string | null };
  }): Promise<PublicMcpAuthorizeResult> {
    let server = d.route;

    await assertPublicMcpRateLimit({
      key: `authz:ip:${d.context.ip}`,
      limit: PUBLIC_MCP_RATE_LIMITS.authorizePerIp
    });

    if (!d.query.clientId) {
      throw new PublicMcpOAuthError('invalid_request', 'client_id is required');
    }

    let client = await publicMcpServerClientService.getClientForAuthorization({
      publicMcpServer: server,
      clientId: d.query.clientId
    });

    if (!d.query.redirectUri || !client.redirectUris.includes(d.query.redirectUri)) {
      throw new PublicMcpOAuthError(
        'invalid_request',
        'redirect_uri does not match any registered redirect URI'
      );
    }

    // From here on the redirect_uri is trusted, so errors are reported to the client.
    let redirectError = (
      error: ConstructorParameters<typeof PublicMcpOAuthError>[0],
      description: string
    ) =>
      new PublicMcpOAuthError(error, description, {
        redirectUri: d.query.redirectUri!,
        state: d.query.state
      });

    if (d.query.responseType !== 'code') {
      throw redirectError('unsupported_response_type', 'Only response_type=code is supported');
    }
    if (d.query.codeChallengeMethod !== 'S256') {
      throw redirectError(
        'invalid_request',
        'PKCE with code_challenge_method=S256 is required'
      );
    }
    if (!d.query.codeChallenge || !codeChallengePattern.test(d.query.codeChallenge)) {
      throw redirectError('invalid_request', 'A valid code_challenge is required');
    }
    if (d.query.scope && d.query.scope.split(' ').some(s => s && s !== PUBLIC_MCP_SCOPE)) {
      throw redirectError(
        'invalid_scope',
        `Only the "${PUBLIC_MCP_SCOPE}" scope is supported`
      );
    }
    if (d.query.resource && normalizeResource(d.query.resource) !== d.baseUrl) {
      throw redirectError('invalid_target', 'resource does not identify this server');
    }

    if (server.status !== 'active') {
      throw redirectError('temporarily_unavailable', 'This server is currently unavailable');
    }
    if (!(await publicMcpServerGrantService.hasCapacity({ publicMcpServer: server }))) {
      throw redirectError('access_denied', 'This server has reached its user limit');
    }

    let bindingNonce = generateSecret('');
    let expiresAt = addMinutes(new Date(), PUBLIC_MCP_AUTHORIZATION_TTL_MINUTES);

    let authorization = await db.publicMcpServerAuthorization.create({
      data: {
        ...getId('publicMcpServerAuthorization'),
        status: 'pending',

        redirectUri: d.query.redirectUri,
        state: d.query.state,
        codeChallenge: d.query.codeChallenge,
        resource: d.query.resource,
        scope: d.query.scope,
        baseUrl: d.baseUrl,

        browserBindingHash: await hashSecret(bindingNonce),

        ip: d.context.ip,
        ua: d.context.ua,

        publicMcpServerOid: server.oid,
        clientOid: client.oid,
        projectOid: server.projectOid,
        instanceOid: server.instanceOid,

        expiresAt
      }
    });

    let bindingCookie = {
      name: getPublicMcpBindingCookieName(authorization.id),
      value: bindingNonce,
      maxAgeSeconds: PUBLIC_MCP_AUTHORIZATION_TTL_MINUTES * 60
    };

    let brand = await db.brand.findUnique({ where: { identifier: server.tenant.id } });

    let setupSession = await providerSetupSessionService.createProviderSetupSessionInternal({
      tenant: server.tenant,
      environment: server.environment,
      provider: server.provider,
      providerDeployment: server.deployment,
      brand: brand ?? undefined,
      input: {
        name: server.name,
        type: 'auto',
        uiMode: 'metorial_elements',
        expiresAt,
        redirectUrl: completionUrl({ baseUrl: d.baseUrl, authorizationId: authorization.id }),

        configuration: {
          ui: {
            layout: 'light'
          }
        }
      },
      import: { ip: d.context.ip, ua: d.context.ua ?? '' },
      internal: { ownerPublicMcpServerOid: server.oid }
    });

    await db.publicMcpServerAuthorization.update({
      where: { oid: authorization.oid },
      data: { status: 'setup', setupSessionOid: setupSession.oid }
    });

    let currentSetupSession = await db.providerSetupSession.findUniqueOrThrow({
      where: { oid: setupSession.oid }
    });

    if (currentSetupSession.status === 'completed') {
      let organization = await metorialDb.instance
        .findUnique({
          where: { oid: server.instanceOid },
          include: { organization: true }
        })
        .then(instance => instance?.organization ?? null);

      let completeUrl = completionUrl({
        baseUrl: d.baseUrl,
        authorizationId: authorization.id
      });

      return {
        type: 'consent',
        completeUrl,
        denyUrl: `${completeUrl}?deny=1`,
        serverName: server.name,
        organizationName: organization?.name ?? null,
        clientName: client.clientName,
        redirectHost: new URL(d.query.redirectUri).host,
        bindingCookie
      };
    }

    return {
      type: 'redirect',
      url: setupSessionUrl(currentSetupSession),
      bindingCookie
    };
  }

  async getSetupSessionContext(d: {
    providerSetupSession: { oid: bigint; ownerPublicMcpServerOid: bigint | null };
  }) {
    if (!d.providerSetupSession.ownerPublicMcpServerOid) return null;

    let authorization = await db.publicMcpServerAuthorization.findUnique({
      where: { setupSessionOid: d.providerSetupSession.oid },
      include: { client: true, publicMcpServer: true }
    });
    if (!authorization) return null;

    let organization = await metorialDb.instance
      .findUnique({
        where: { oid: authorization.publicMcpServer.instanceOid },
        include: { organization: true }
      })
      .then(instance => instance?.organization ?? null);

    return {
      serverName: authorization.publicMcpServer.name,
      organizationName: organization?.name ?? null,
      clientName: authorization.client.clientName,
      clientUri: authorization.client.clientUri,
      redirectHost: new URL(authorization.redirectUri).host,
      // Dynamically registered clients self-assert their name and URI.
      isClientVerified: false
    };
  }

  async complete(d: {
    route: PublicMcpRoute;
    authorizationId: string;
    bindingNonce: string | null;
    deny?: boolean;
    context: { ip: string; ua: string | null };
  }) {
    let server = d.route;

    await assertPublicMcpRateLimit({
      key: `complete:ip:${d.context.ip}`,
      limit: PUBLIC_MCP_RATE_LIMITS.completePerIp
    });

    let authorization = await db.publicMcpServerAuthorization.findFirst({
      where: { id: d.authorizationId, publicMcpServerOid: server.oid },
      include: { client: true, setupSession: true }
    });
    if (!authorization) {
      throw new PublicMcpOAuthError('invalid_request', 'Unknown authorization request');
    }

    if (
      !d.bindingNonce ||
      !secretsEqual(await hashSecret(d.bindingNonce), authorization.browserBindingHash)
    ) {
      throw new PublicMcpOAuthError(
        'access_denied',
        'This sign-in was started in a different browser. Start again from your MCP client.',
        { status: 403 }
      );
    }

    let redirectError = (
      error: ConstructorParameters<typeof PublicMcpOAuthError>[0],
      description: string
    ) =>
      new PublicMcpOAuthError(error, description, {
        redirectUri: authorization.redirectUri,
        state: authorization.state
      });

    if (authorization.status === 'code_issued' || authorization.status === 'exchanged') {
      throw new PublicMcpOAuthError(
        'invalid_request',
        'This sign-in has already been completed. Return to your MCP client.'
      );
    }

    if (
      authorization.status !== 'setup' ||
      authorization.expiresAt <= new Date() ||
      !authorization.setupSession
    ) {
      throw redirectError('access_denied', 'The sign-in request has expired');
    }

    if (d.deny) {
      await db.publicMcpServerAuthorization.updateMany({
        where: { oid: authorization.oid, status: 'setup' },
        data: { status: 'denied', completedAt: new Date() }
      });
      throw redirectError('access_denied', 'The user denied the request');
    }

    let setupSession = authorization.setupSession;
    if (setupSession.ownerPublicMcpServerOid !== server.oid) {
      throw redirectError('server_error', 'The sign-in request is invalid');
    }

    if (setupSession.status === 'failed' || setupSession.status === 'expired') {
      await db.publicMcpServerAuthorization.updateMany({
        where: { oid: authorization.oid, status: 'setup' },
        data: { status: 'failed', completedAt: new Date() }
      });
      throw redirectError('access_denied', 'The setup was not completed');
    }

    if (setupSession.status !== 'completed') {
      return { type: 'redirect' as const, url: setupSessionUrl(setupSession) };
    }

    if (server.status !== 'active') {
      throw redirectError('temporarily_unavailable', 'This server is currently unavailable');
    }
    if (!(await publicMcpServerGrantService.hasCapacity({ publicMcpServer: server }))) {
      throw redirectError('access_denied', 'This server has reached its user limit');
    }

    let eventBase = await getSubspaceSystemProviderEventBase({
      job: 'subspace/publicMcpAuthorization',
      instanceOid: server.instanceOid
    });
    await Fabric.fire('provider.public_mcp_grant.created:before', {
      ...eventBase,
      publicMcpServer: server
    });

    let code = generateSecret(AUTHORIZATION_CODE_PREFIX);
    let codeHash = await hashSecret(code);
    let now = new Date();

    let grant = await withPublicMcpGrantCapacity(server, async () => {
      if (!(await publicMcpServerGrantService.hasCapacity({ publicMcpServer: server }))) {
        throw redirectError('access_denied', 'This server has reached its user limit');
      }

      return await withTransaction(async db => {
        let claimed = await db.publicMcpServerAuthorization.updateMany({
          where: { oid: authorization.oid, status: 'setup' },
          data: {
            status: 'code_issued',
            authorizationCodeHash: codeHash,
            codeExpiresAt: addMinutes(now, PUBLIC_MCP_AUTHORIZATION_CODE_TTL_MINUTES),
            completedAt: now
          }
        });
        if (claimed.count !== 1) return null;

        return await db.publicMcpServerGrant.create({
          data: {
            ...getId('publicMcpServerGrant'),
            status: 'pending_exchange',

            tenantOid: server.tenantOid,
            projectOid: server.projectOid,
            environmentOid: server.environmentOid,
            instanceOid: server.instanceOid,
            solutionOid: server.solutionOid,

            publicMcpServerOid: server.oid,
            clientOid: authorization.clientOid,
            authorizationOid: authorization.oid,
            deploymentOid: server.deploymentOid,
            configOid: setupSession.configOid,
            authConfigOid: setupSession.authConfigOid,

            expiresAt: addMinutes(now, PUBLIC_MCP_AUTHORIZATION_CODE_TTL_MINUTES)
          },
          include: { publicMcpServer: true, client: true }
        });
      });
    });

    if (!grant) {
      throw new PublicMcpOAuthError(
        'invalid_request',
        'This sign-in has already been completed. Return to your MCP client.'
      );
    }

    await Fabric.fire('provider.public_mcp_grant.created:after', { ...eventBase, grant });

    return {
      type: 'redirect' as const,
      url: redirectWithCode({
        redirectUri: authorization.redirectUri,
        code,
        state: authorization.state,
        issuer: authorization.baseUrl
      })
    };
  }
}

export let publicMcpServerAuthorizationService = Service.create(
  'publicMcpServerAuthorization',
  () => new publicMcpServerAuthorizationServiceImpl()
).build();
