import {
  badRequestError,
  notFoundError,
  ServiceError,
  unauthorizedError
} from '@lowerdeck/error';
import { getConfig } from '@metorial/config';
import { db, Prisma } from '@metorial/db';
import {
  consumerProfileService,
  grantConsumerOwnedMagicMcpTokenAccess
} from '@metorial/module-consumer';
import {
  MagicMcpResolvedTarget,
  magicMcpTokenService,
  resolveMagicMcpTargetByIdOrAlias
} from '@metorial/module-magic';
import { portalService } from '@metorial/module-portal';
import { addDays } from 'date-fns';
import { createCodeChallenge, createOpaqueToken } from './challenge';
import { urlsMatch } from './utils';

let portalAuthAttemptInclude = {
  portalAuthClient: true,
  consumerProfile: true,
  magicMcpEndpoint: true,
  magicMcpToken: true
} satisfies Prisma.PortalAuthAttemptInclude;

type PortalAuthAttemptWithRelations = Prisma.PortalAuthAttemptGetPayload<{
  include: typeof portalAuthAttemptInclude;
}>;

export let resolvePortalRoute = async (d: {
  portalId: string;
  magicMcpTargetId?: string;
}) => {
  let portal = await portalService.getPortalPublic({ portalId: d.portalId });
  let magicMcpTarget = d.magicMcpTargetId
    ? await resolveMagicMcpTargetByIdOrAlias(d.magicMcpTargetId)
    : null;

  if (magicMcpTarget && portal.instance.oid != magicMcpTarget.target.instance.oid) {
    throw new ServiceError(notFoundError('magic_mcp.target'));
  }

  return {
    portal,
    magicMcpTarget,
    base: `${getConfig().urls.apiUrl}/connect/portal/${d.portalId}${
      d.magicMcpTargetId ? `/${d.magicMcpTargetId}` : ''
    }`,
    portalUrl: portalService.getPortalHost({ portal }).host
  };
};

export let getPortalAuthClient = async (d: {
  clientId: string;
  portalOid: bigint;
  magicMcpServerOid?: bigint;
  magicMcpEndpointOid?: bigint;
}) => {
  let client = await db.portalAuthClient.findFirst({
    where: {
      clientId: d.clientId,
      portalOid: d.portalOid,
      magicMcpServerOid: d.magicMcpServerOid ?? null,
      magicMcpEndpointOid: d.magicMcpEndpointOid ?? null
    }
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

export let validateClientSecret = (d: {
  client: Awaited<ReturnType<typeof getPortalAuthClient>>;
  clientSecret?: string;
}) => {
  if (d.client.tokenEndpointAuthMethod == 'none') {
    if (d.clientSecret) {
      throw new ServiceError(
        unauthorizedError({
          message: 'This oauth client must not use a client secret',
          oauth: {
            error: 'invalid_client',
            errorMessage: 'This oauth client must not use a client secret'
          }
        })
      );
    }

    return;
  }

  if (!d.clientSecret || d.client.clientSecret != d.clientSecret) {
    throw new ServiceError(
      unauthorizedError({
        message: 'Invalid oauth client secret',
        oauth: {
          error: 'invalid_client',
          errorMessage: 'Invalid oauth client secret'
        }
      })
    );
  }
};

let ensureAttemptNotExpired = (attempt: Pick<PortalAuthAttemptWithRelations, 'expiresAt'>) => {
  if (attempt.expiresAt < new Date()) {
    throw new ServiceError(
      badRequestError({
        message: 'The portal authorization has expired',
        oauth: {
          error: 'invalid_grant',
          errorMessage: 'The portal authorization has expired'
        }
      })
    );
  }
};

let ensureLinkedAccessToken = async (d: {
  attempt: PortalAuthAttemptWithRelations;
  portal: Awaited<ReturnType<typeof portalService.getPortalPublic>>;
  magicMcpTarget: MagicMcpResolvedTarget | null;
}) => {
  if (d.attempt.magicMcpToken) {
    if (d.attempt.magicMcpToken.status != 'active') {
      throw new ServiceError(
        badRequestError({
          message: 'The linked magic MCP token is no longer active',
          oauth: {
            error: 'invalid_grant',
            errorMessage: 'The linked magic MCP token is no longer active'
          }
        })
      );
    }

    return d.attempt.magicMcpToken;
  }

  if (!d.attempt.consumerProfile) {
    throw new ServiceError(
      badRequestError({
        message: 'The portal authorization is missing a consumer profile',
        oauth: {
          error: 'invalid_grant',
          errorMessage: 'The portal authorization is missing a consumer profile'
        }
      })
    );
  }

  let magicMcpEndpoint =
    d.attempt.magicMcpEndpoint ??
    (d.magicMcpTarget?.type === 'endpoint' ? d.magicMcpTarget.target : undefined);
  let magicMcpServer =
    !magicMcpEndpoint && d.magicMcpTarget?.type === 'server'
      ? d.magicMcpTarget.target
      : undefined;

  if (!magicMcpServer && !magicMcpEndpoint) {
    throw new ServiceError(
      badRequestError({
        message: 'The portal authorization is not linked to a magic MCP server or endpoint',
        oauth: {
          error: 'invalid_grant',
          errorMessage:
            'The portal authorization is not linked to a magic MCP server or endpoint'
        }
      })
    );
  }

  let magicMcpToken = await magicMcpTokenService.createMagicMcpToken({
    instance: d.portal.instance,
    input: {
      name: `${d.portal.name} Portal Access`,
      description: `OAuth access token for ${d.attempt.portalAuthClient.name}`,
      magicMcpServer,
      magicMcpEndpoint
    }
  });

  let consumerGroups = await consumerProfileService.getGroupsForProfile({
    consumerProfile: d.attempt.consumerProfile
  });

  await grantConsumerOwnedMagicMcpTokenAccess({
    organization: d.portal.organization,
    consumerProfile: d.attempt.consumerProfile,
    consumerGroups,
    magicMcpToken
  });

  await db.portalAuthAttempt.update({
    where: {
      id: d.attempt.id
    },
    data: {
      magicMcpTokenOid: magicMcpToken.oid
    }
  });

  return magicMcpToken;
};

export let exchangeAuthorizationCodeToken = async (d: {
  portal: Awaited<ReturnType<typeof portalService.getPortalPublic>>;
  magicMcpTarget: MagicMcpResolvedTarget | null;
  client: Awaited<ReturnType<typeof getPortalAuthClient>>;
  code: string;
  redirectUri: string;
  codeVerifier?: string;
}) => {
  let attempt = await db.portalAuthAttempt.findFirst({
    where: {
      portalAuthClientOid: d.client.oid,
      authorizationCode: d.code
    },
    include: portalAuthAttemptInclude
  });

  if (!attempt || attempt.status != 'authorized') {
    throw new ServiceError(
      badRequestError({
        message: 'Invalid authorization code',
        oauth: {
          error: 'invalid_grant',
          errorMessage: 'Invalid authorization code'
        }
      })
    );
  }

  ensureAttemptNotExpired(attempt);

  if (!attempt.authorizationCodeExpiresAt || attempt.authorizationCodeExpiresAt < new Date()) {
    throw new ServiceError(
      badRequestError({
        message: 'Authorization code has expired',
        oauth: {
          error: 'invalid_grant',
          errorMessage: 'Authorization code has expired'
        }
      })
    );
  }

  if (attempt.authorizationCodeUsedAt) {
    throw new ServiceError(
      badRequestError({
        message: 'Authorization code has already been used',
        oauth: {
          error: 'invalid_grant',
          errorMessage: 'Authorization code has already been used'
        }
      })
    );
  }

  if (!urlsMatch(attempt.redirectUri, d.redirectUri)) {
    throw new ServiceError(
      badRequestError({
        message: 'Redirect URI does not match the authorization request',
        oauth: {
          error: 'invalid_grant',
          errorMessage: 'Redirect URI does not match the authorization request'
        }
      })
    );
  }

  if (attempt.codeChallengeMethod == 's256') {
    if (!d.codeVerifier) {
      throw new ServiceError(
        badRequestError({
          message: 'A code verifier is required for this authorization request',
          oauth: {
            error: 'invalid_grant',
            errorMessage: 'A code verifier is required for this authorization request'
          }
        })
      );
    }

    let codeChallenge = await createCodeChallenge(d.codeVerifier);
    if (codeChallenge != attempt.codeChallenge) {
      throw new ServiceError(
        badRequestError({
          message: 'Invalid PKCE code verifier',
          oauth: {
            error: 'invalid_grant',
            errorMessage: 'Invalid PKCE code verifier'
          }
        })
      );
    }
  } else if (d.codeVerifier) {
    throw new ServiceError(
      badRequestError({
        message: 'Code verifier is not allowed for this authorization request',
        oauth: {
          error: 'invalid_grant',
          errorMessage: 'Code verifier is not allowed for this authorization request'
        }
      })
    );
  }

  let accessToken = await ensureLinkedAccessToken({
    attempt,
    portal: d.portal,
    magicMcpTarget: d.magicMcpTarget
  });

  let refreshToken = createOpaqueToken();
  let updatedAttempt = await db.portalAuthAttempt.update({
    where: {
      id: attempt.id
    },
    data: {
      status: 'active',
      authorizationCodeUsedAt: new Date(),
      refreshToken,
      expiresAt: addDays(new Date(), 30)
    }
  });

  return {
    accessToken: accessToken.secret,
    refreshToken: updatedAttempt.refreshToken!
  };
};

export let exchangeRefreshToken = async (d: {
  portal: Awaited<ReturnType<typeof portalService.getPortalPublic>>;
  magicMcpTarget: MagicMcpResolvedTarget | null;
  client: Awaited<ReturnType<typeof getPortalAuthClient>>;
  refreshToken: string;
}) => {
  let attempt = await db.portalAuthAttempt.findFirst({
    where: {
      portalAuthClientOid: d.client.oid,
      refreshToken: d.refreshToken
    },
    include: portalAuthAttemptInclude
  });

  if (!attempt || attempt.status != 'active') {
    throw new ServiceError(
      badRequestError({
        message: 'Invalid refresh token',
        oauth: {
          error: 'invalid_grant',
          errorMessage: 'Invalid refresh token'
        }
      })
    );
  }

  ensureAttemptNotExpired(attempt);

  let accessToken = await ensureLinkedAccessToken({
    attempt,
    portal: d.portal,
    magicMcpTarget: d.magicMcpTarget
  });

  let nextRefreshToken = createOpaqueToken();
  let updatedAttempt = await db.portalAuthAttempt.update({
    where: {
      id: attempt.id
    },
    data: {
      refreshToken: nextRefreshToken,
      expiresAt: addDays(new Date(), 30)
    }
  });

  return {
    accessToken: accessToken.secret,
    refreshToken: updatedAttempt.refreshToken!
  };
};
