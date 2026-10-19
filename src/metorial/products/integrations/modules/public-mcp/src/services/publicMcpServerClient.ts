import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  db,
  type Environment,
  getId,
  ID,
  type PublicMcpServer,
  type PublicMcpServerClient,
  type PublicMcpServerClientAuthMethod,
  type Tenant
} from '@metorial-subspace/db';
import {
  checkTenant,
  type MetorialFacing,
  resolveMetorialFacing
} from '@metorial-subspace/module-tenant';
import {
  portalRedirectUriMatchesAllowedFilters,
  validateUrlString
} from '@metorial/consumer-oauth-utils';
import { addDays } from 'date-fns';
import { assertPublicMcpRateLimit } from '../internal/rateLimit';
import {
  PUBLIC_MCP_CLIENT_IDLE_TTL_DAYS,
  PUBLIC_MCP_MAX_CLIENT_NAME_LENGTH,
  PUBLIC_MCP_MAX_REDIRECT_URIS,
  PUBLIC_MCP_RATE_LIMITS
} from '../lib/constants';
import { PublicMcpOAuthError } from '../lib/oauthError';
import { generateSecret, hashSecret, secretsEqual } from '../lib/secrets';

let CLIENT_SECRET_PREFIX = 'metorial_pmcs_';
let REGISTRATION_TOKEN_PREFIX = 'metorial_pmrt_';

let supportedGrantTypes = new Set(['authorization_code', 'refresh_token']);
let supportedAuthMethods = new Set<PublicMcpServerClientAuthMethod>([
  'none',
  'client_secret_basic',
  'client_secret_post'
]);

let isLoopbackHost = (hostname: string) =>
  hostname === 'localhost' ||
  hostname === '127.0.0.1' ||
  hostname === '[::1]' ||
  hostname.endsWith('.localhost');

let validateRedirectUris = (d: { server: PublicMcpServer; redirectUris: unknown }) => {
  if (
    !Array.isArray(d.redirectUris) ||
    d.redirectUris.length === 0 ||
    d.redirectUris.length > PUBLIC_MCP_MAX_REDIRECT_URIS ||
    d.redirectUris.some(uri => typeof uri !== 'string')
  ) {
    throw new PublicMcpOAuthError(
      'invalid_redirect_uri',
      `redirect_uris must contain between 1 and ${PUBLIC_MCP_MAX_REDIRECT_URIS} URLs`
    );
  }

  let filters = d.server.redirectUriFilters.length
    ? d.server.redirectUriFilters.map(url => ({ url }))
    : undefined;

  for (let redirectUri of d.redirectUris as string[]) {
    try {
      validateUrlString(redirectUri, 'redirect_uri');
    } catch {
      throw new PublicMcpOAuthError(
        'invalid_redirect_uri',
        `Invalid redirect_uri: ${redirectUri}`
      );
    }

    let url = new URL(redirectUri);
    if (url.hash) {
      throw new PublicMcpOAuthError(
        'invalid_redirect_uri',
        'redirect_uris must not contain a fragment'
      );
    }
    if (url.protocol === 'http:' && !isLoopbackHost(url.hostname)) {
      throw new PublicMcpOAuthError(
        'invalid_redirect_uri',
        'http redirect_uris are only allowed for loopback addresses'
      );
    }

    if (
      !portalRedirectUriMatchesAllowedFilters({
        redirectUri,
        allowedRedirectUrlFilters: filters
      })
    ) {
      throw new PublicMcpOAuthError(
        'invalid_redirect_uri',
        `redirect_uri is not allowed for this server: ${redirectUri}`
      );
    }
  }

  return d.redirectUris as string[];
};

let optionalUrl = (value: unknown, field: string) => {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') {
    throw new PublicMcpOAuthError('invalid_client_metadata', `${field} must be a string`);
  }

  try {
    let url = new URL(value);
    if (url.protocol !== 'https:') throw new Error('not https');
  } catch {
    throw new PublicMcpOAuthError('invalid_client_metadata', `${field} must be an https URL`);
  }

  return value;
};

export let presentClientRegistration = (d: {
  client: PublicMcpServerClient;
  clientSecret?: string | null;
  registrationAccessToken?: string;
  registrationClientUri: string;
}) => ({
  client_id: d.client.clientId,
  ...(d.clientSecret ? { client_secret: d.clientSecret, client_secret_expires_at: 0 } : {}),
  client_id_issued_at: Math.floor(d.client.createdAt.getTime() / 1000),
  client_name: d.client.clientName,
  client_uri: d.client.clientUri ?? undefined,
  logo_uri: d.client.logoUri ?? undefined,
  redirect_uris: d.client.redirectUris,
  grant_types: ['authorization_code', 'refresh_token'],
  response_types: ['code'],
  token_endpoint_auth_method: d.client.tokenEndpointAuthMethod,
  ...(d.registrationAccessToken
    ? { registration_access_token: d.registrationAccessToken }
    : {}),
  registration_client_uri: d.registrationClientUri
});

export type RegisterPublicMcpServerClientParams = {
  publicMcpServer: PublicMcpServer;
  input: Record<string, unknown>;
  context: { ip: string; ua: string | null };
};

class publicMcpServerClientServiceImpl {
  async registerClient(d: RegisterPublicMcpServerClientParams) {
    if (d.publicMcpServer.status !== 'active') {
      throw new PublicMcpOAuthError(
        'temporarily_unavailable',
        'This server is not accepting new clients',
        { status: 403 }
      );
    }

    await assertPublicMcpRateLimit({
      key: `reg:ip:${d.context.ip}`,
      limit: PUBLIC_MCP_RATE_LIMITS.registerPerIp
    });
    await assertPublicMcpRateLimit({
      key: `reg:srv:${d.publicMcpServer.oid}`,
      limit: PUBLIC_MCP_RATE_LIMITS.registerPerServer
    });

    let redirectUris = validateRedirectUris({
      server: d.publicMcpServer,
      redirectUris: d.input.redirect_uris
    });

    let grantTypes = d.input.grant_types ?? ['authorization_code'];
    if (
      !Array.isArray(grantTypes) ||
      grantTypes.some(type => !supportedGrantTypes.has(type as string))
    ) {
      throw new PublicMcpOAuthError(
        'invalid_client_metadata',
        'Only the authorization_code and refresh_token grant types are supported'
      );
    }

    let responseTypes = d.input.response_types ?? ['code'];
    if (!Array.isArray(responseTypes) || responseTypes.some(type => type !== 'code')) {
      throw new PublicMcpOAuthError(
        'invalid_client_metadata',
        'Only the code response type is supported'
      );
    }

    let tokenEndpointAuthMethod = (d.input.token_endpoint_auth_method ??
      'client_secret_basic') as PublicMcpServerClientAuthMethod;
    if (!supportedAuthMethods.has(tokenEndpointAuthMethod)) {
      throw new PublicMcpOAuthError(
        'invalid_client_metadata',
        'Unsupported token_endpoint_auth_method'
      );
    }

    let clientName =
      typeof d.input.client_name === 'string' && d.input.client_name.trim()
        ? d.input.client_name.trim().slice(0, PUBLIC_MCP_MAX_CLIENT_NAME_LENGTH)
        : 'MCP Client';

    let clientSecret =
      tokenEndpointAuthMethod === 'none' ? null : generateSecret(CLIENT_SECRET_PREFIX);
    let registrationAccessToken = generateSecret(REGISTRATION_TOKEN_PREFIX);

    let client = await db.publicMcpServerClient.create({
      data: {
        ...getId('publicMcpServerClient'),
        clientId: ID.generateIdSync('publicMcpServerClient_clientId'),
        clientSecretHash: clientSecret ? await hashSecret(clientSecret) : null,
        registrationAccessTokenHash: await hashSecret(registrationAccessToken),
        tokenEndpointAuthMethod,

        clientName,
        clientUri: optionalUrl(d.input.client_uri, 'client_uri'),
        logoUri: optionalUrl(d.input.logo_uri, 'logo_uri'),
        redirectUris,

        registrationIp: d.context.ip,
        registrationUa: d.context.ua,

        publicMcpServerOid: d.publicMcpServer.oid,
        projectOid: d.publicMcpServer.projectOid,
        instanceOid: d.publicMcpServer.instanceOid,

        expiresAt: addDays(new Date(), PUBLIC_MCP_CLIENT_IDLE_TTL_DAYS)
      }
    });

    return { client, clientSecret, registrationAccessToken };
  }

  async getClientRegistration(d: {
    publicMcpServer: PublicMcpServer;
    clientId: string;
    registrationAccessToken: string | null;
  }) {
    let client = await this.findActiveClient(d);
    if (
      !client ||
      !d.registrationAccessToken ||
      !secretsEqual(
        await hashSecret(d.registrationAccessToken),
        client.registrationAccessTokenHash
      )
    ) {
      throw new PublicMcpOAuthError('invalid_client', 'Invalid client credentials', {
        status: 401
      });
    }

    return client;
  }

  async getClientForAuthorization(d: { publicMcpServer: PublicMcpServer; clientId: string }) {
    let client = await this.findActiveClient(d);
    if (!client) throw new PublicMcpOAuthError('invalid_client', 'Unknown client_id');

    return client;
  }

  async authenticateClient(d: {
    publicMcpServer: PublicMcpServer;
    clientId: string | null;
    clientSecret: string | null;
    method: 'client_secret_basic' | 'client_secret_post' | 'none';
  }) {
    let invalid = () =>
      new PublicMcpOAuthError('invalid_client', 'Client authentication failed', {
        status: 401
      });

    if (!d.clientId) throw invalid();

    let client = await this.findActiveClient({
      publicMcpServer: d.publicMcpServer,
      clientId: d.clientId
    });
    if (!client) throw invalid();

    if (client.tokenEndpointAuthMethod !== 'none') {
      if (d.method !== client.tokenEndpointAuthMethod || !d.clientSecret) throw invalid();
      if (
        !client.clientSecretHash ||
        !secretsEqual(await hashSecret(d.clientSecret), client.clientSecretHash)
      ) {
        throw invalid();
      }
    }

    await db.publicMcpServerClient.updateMany({
      where: { oid: client.oid },
      data: {
        lastUsedAt: new Date(),
        expiresAt: addDays(new Date(), PUBLIC_MCP_CLIENT_IDLE_TTL_DAYS)
      }
    });

    return client;
  }

  async listClients(d: MetorialFacing<{ publicMcpServer: PublicMcpServer }>) {
    let scope = await resolveMetorialFacing(d);

    return this.listClientsInternal({
      tenant: scope.tenant,
      environment: scope.environment,
      publicMcpServer: d.publicMcpServer
    });
  }

  async listClientsInternal(d: {
    tenant: Tenant;
    environment: Environment;
    publicMcpServer: PublicMcpServer;
  }) {
    checkTenant(d, d.publicMcpServer);

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.publicMcpServerClient.findMany({
            ...opts,
            where: { publicMcpServerOid: d.publicMcpServer.oid }
          })
      )
    );
  }

  async getClientByIdInternal(d: {
    tenant: Tenant;
    environment: Environment;
    publicMcpServer: PublicMcpServer;
    publicMcpServerClientId: string;
  }) {
    checkTenant(d, d.publicMcpServer);

    let client = await db.publicMcpServerClient.findFirst({
      where: { id: d.publicMcpServerClientId, publicMcpServerOid: d.publicMcpServer.oid }
    });
    if (!client) {
      throw new ServiceError(
        notFoundError('public_mcp_server.client', d.publicMcpServerClientId)
      );
    }

    return client;
  }

  private async findActiveClient(d: { publicMcpServer: PublicMcpServer; clientId: string }) {
    return await db.publicMcpServerClient.findFirst({
      where: {
        clientId: d.clientId,
        publicMcpServerOid: d.publicMcpServer.oid,
        expiresAt: { gt: new Date() }
      }
    });
  }
}

export let publicMcpServerClientService = Service.create(
  'publicMcpServerClient',
  () => new publicMcpServerClientServiceImpl()
).build();
