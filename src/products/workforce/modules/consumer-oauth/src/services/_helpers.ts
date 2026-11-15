import {
  badRequestError,
  createError,
  preconditionFailedError,
  ServiceError,
  unauthorizedError
} from '@lowerdeck/error';
import { Hash } from '@lowerdeck/hash';
import { getConfig } from '@metorial/config';
import {
  db,
  SkillPlugin,
  type ConsumerAuthAttempt,
  type ConsumerAuthClient,
  type ConsumerSurface
} from '@metorial/db';
import { addMonths, addSeconds, subDays } from 'date-fns';
import {
  consumerAuthAccessTokenTtlSeconds,
  consumerAuthClientExpiryRenewalIntervalDays,
  consumerAuthClientInactivityExpiryMonths,
  consumerAuthClientInclude,
  consumerAuthRefreshTokenTtlSeconds,
  ConsumerClientMetadataInput,
  ConsumerOAuthAuthorization,
  ConsumerOAuthClient,
  DashboardConsumerSurface
} from './_types';

let CLIENT_METADATA_URL_MAX_LENGTH = 2048;

export let getConsumerAuthRefreshTokenExpiry = () =>
  addSeconds(new Date(), consumerAuthRefreshTokenTtlSeconds);

export let getConsumerAuthAccessTokenExpiry = () =>
  addSeconds(new Date(), consumerAuthAccessTokenTtlSeconds);

export let getConsumerAuthClientExpiry = () =>
  addMonths(new Date(), consumerAuthClientInactivityExpiryMonths);

export let slideConsumerAuthClientExpiration = async (d: {
  consumerAuthClient: Pick<ConsumerAuthClient, 'oid' | 'expiresAt'>;
}) => {
  let expiresAt = getConsumerAuthClientExpiry();
  let renewalThreshold = subDays(expiresAt, consumerAuthClientExpiryRenewalIntervalDays);
  if (d.consumerAuthClient.expiresAt >= renewalThreshold) return;

  await db.consumerAuthClient.updateMany({
    where: {
      oid: d.consumerAuthClient.oid,
      expiresAt: { lt: renewalThreshold }
    },
    data: { expiresAt }
  });
};

export let consumerAuthClientRegistrationRateLimitError = createError({
  status: 429,
  code: 'rate_limit_exceeded',
  message: 'Too many OAuth client registrations from this IP address'
});

export let ensurePendingConsumerAuthAuthorization = (
  portalOAuthAuthorization: Pick<ConsumerAuthAttempt, 'status'>
) => {
  if (portalOAuthAuthorization.status != 'pending') {
    throw new ServiceError(
      preconditionFailedError({
        message: 'This OAuth authorization is no longer pending.'
      })
    );
  }
};

export let ensureAttemptNotExpired = (
  attempt: Pick<ConsumerOAuthAuthorization, 'expiresAt'>
) => {
  if (attempt.expiresAt < new Date()) {
    throw new ServiceError(
      badRequestError({
        message: 'The authorization has expired',
        oauth: {
          error: 'invalid_grant',
          errorMessage: 'The authorization has expired'
        }
      })
    );
  }
};

export let resolveConsumerSurface = (d: {
  portal?: { surface: ConsumerSurface };
  consumerSurface?: ConsumerSurface;
}) => {
  return d.consumerSurface ?? d.portal?.surface;
};

export let normalizeConsumerClientRedirectUris = (redirectUris: string[]) =>
  [...redirectUris].sort();

let normalizeClientMetadataUrl = (value: string | undefined, field: string) => {
  let trimmed = value?.trim();
  if (!trimmed) return undefined;

  let url: URL | null = null;
  try {
    url = new URL(trimmed);
  } catch {}

  if (
    !url ||
    trimmed.length > CLIENT_METADATA_URL_MAX_LENGTH ||
    url.protocol != 'https:' ||
    url.username ||
    url.password
  ) {
    throw new ServiceError(
      badRequestError({
        message: `${field} must be a valid https URL`,
        oauth: {
          error: 'invalid_client_metadata',
          errorMessage: `${field} must be a valid https URL`
        }
      })
    );
  }

  return url.toString();
};

export let normalizeConsumerClientMetadata = (d: ConsumerClientMetadataInput) => ({
  clientUri: normalizeClientMetadataUrl(d.clientUri, 'client_uri'),
  logoUri: normalizeClientMetadataUrl(d.logoUri, 'logo_uri'),
  tosUri: normalizeClientMetadataUrl(d.tosUri, 'tos_uri'),
  policyUri: normalizeClientMetadataUrl(d.policyUri, 'policy_uri')
});

export let getConsumerClientHash = async (d: { name: string; redirectUris: string[] }) =>
  await Hash.sha256(
    JSON.stringify([d.name, normalizeConsumerClientRedirectUris(d.redirectUris)])
  );

export let getAttemptMagicMcpEndpoint = (
  attempt: Pick<ConsumerOAuthAuthorization, 'magicMcpEndpoint' | 'consumerProfile'> & {
    consumerAuthClient: Pick<
      ConsumerOAuthAuthorization['consumerAuthClient'],
      'magicMcpEndpoint'
    >;
  }
) => {
  return attempt.magicMcpEndpoint ?? attempt.consumerAuthClient.magicMcpEndpoint ?? null;
};

export let getConsumerAuthClient = async (d: {
  clientId: string;
  consumerSurfaceOid: bigint;
  skillPluginOid?: bigint;
  magicMcpServerOid?: bigint;
  magicMcpEndpointOid?: bigint;
}) => {
  let client = await db.consumerAuthClient.findFirst({
    where: {
      clientId: d.clientId,
      consumerAuthClientSurfaces: {
        some: {
          consumerSurfaceOid: d.consumerSurfaceOid
        }
      },
      skillPluginOid: d.skillPluginOid ?? null,
      magicMcpServerOid: d.magicMcpServerOid ?? null,
      magicMcpEndpointOid: d.magicMcpEndpointOid ?? null
    },
    include: consumerAuthClientInclude
  });

  if (!client || client.expiresAt < new Date()) {
    throw new ServiceError(
      unauthorizedError({
        message: 'Invalid oauth client',
        oauth: {
          error: 'invalid_client',
          errorMessage: 'Invalid oauth client'
        }
      })
    );
  }

  return client;
};

export let getConsumerAuthClientSurface = (
  client: Pick<ConsumerOAuthClient, 'consumerAuthClientSurfaces'>
) => {
  return client.consumerAuthClientSurfaces[0]?.consumerSurface ?? null;
};

export let getConsumerAuthClientPlugin = (
  client: Pick<ConsumerOAuthClient, 'skillPlugin'>
) => {
  return client.skillPlugin ?? null;
};

export let ensureSkillPluginMatchesEndpoint = (d: {
  skillPlugin?: Pick<SkillPlugin, 'oid' | 'id'> | null;
  magicMcpEndpoint?: { skillPluginOid: bigint | null } | null;
}) => {
  if (!d.skillPlugin || !d.magicMcpEndpoint?.skillPluginOid) return;

  if (d.magicMcpEndpoint.skillPluginOid != d.skillPlugin.oid) {
    throw new ServiceError(
      preconditionFailedError({
        message: 'This Magic MCP endpoint is not part of the requested Metorial Skill.'
      })
    );
  }
};

export let buildDashboardConsumerAuthUrl = (d: {
  consumerSurface: DashboardConsumerSurface;
  consumerAuthAttemptId: string;
}) => {
  let url = new URL(getConfig().urls.appUrl);
  let basePath = url.pathname.replace(/\/+$/, '');
  url.pathname =
    `${basePath}/i/${d.consumerSurface.instance.organization.id}/${d.consumerSurface.instance.project.id}/${d.consumerSurface.instance.id}/consumer-auth/authorize/${d.consumerAuthAttemptId}`.replace(
      /\/{2,}/g,
      '/'
    );
  url.search = '';
  url.hash = '';

  return url.toString();
};

export let buildConsumerOAuthCallbackRedirectUrl = (d: {
  redirectUri: string;
  state?: string | null;
  status: 'pending' | 'authorized' | 'active' | 'denied' | 'revoked';
  authorizationCode?: string | null;
}) => {
  if (d.status != 'authorized' && d.status != 'denied') {
    return null;
  }

  let url = new URL(d.redirectUri);

  if (d.status == 'authorized' && d.authorizationCode) {
    url.searchParams.set('code', d.authorizationCode);
  } else if (d.status == 'denied') {
    url.searchParams.set('error', 'access_denied');
    url.searchParams.set('error_description', 'The portal authorization request was denied.');
  }

  if (d.state) {
    url.searchParams.set('state', d.state);
  }

  return url.toString();
};
