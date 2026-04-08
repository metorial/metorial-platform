import {
  badRequestError,
  createError,
  notFoundError,
  preconditionFailedError,
  ServiceError,
  unauthorizedError
} from '@lowerdeck/error';
import { generateCustomId } from '@lowerdeck/id';
import { Service } from '@lowerdeck/service';
import { getConfig } from '@metorial/config';
import {
  db,
  ID,
  Prisma,
  withTransaction,
  type ConsumerProfile,
  type ConsumerSurface,
  type Instance,
  type PortalAuthAttempt
} from '@metorial/db';
import { type AnyAccessTagSelector } from '@metorial/module-access';
import {
  consumerProfileService,
  grantConsumerOwnedMagicMcpTokenAccess
} from '@metorial/module-consumer';
import {
  magicMcpEndpointService,
  magicMcpTokenService,
  resolveMagicMcpTargetByIdOrAlias,
  type MagicMcpResolvedTarget
} from '@metorial/module-magic';
import { addDays, addMinutes, addSeconds } from 'date-fns';
import {
  createCodeChallenge,
  getPortalAllowedRedirectUrlFilters,
  urlsMatch,
  validatePortalRedirectUrisAgainstAllowedFilters,
  validateRedirectUri,
  validateUrlString
} from '../lib/oauth';
import { portalService } from './portal';

let portalAuthClientInclude = {
  portal: true,
  magicMcpServer: true,
  magicMcpEndpoint: true
} satisfies Prisma.PortalAuthClientInclude;

let portalAuthAttemptInclude = {
  portalAuthClient: {
    include: portalAuthClientInclude
  },
  consumerProfile: true,
  magicMcpEndpoint: true,
  magicMcpToken: true
} satisfies Prisma.PortalAuthAttemptInclude;

export type PortalOAuthClient = Prisma.PortalAuthClientGetPayload<{
  include: typeof portalAuthClientInclude;
}>;

export type PortalOAuthAuthorization = Prisma.PortalAuthAttemptGetPayload<{
  include: typeof portalAuthAttemptInclude;
}>;

export let portalRefreshTokenTtlSeconds = 7 * 24 * 60 * 60;
export let portalAccessTokenTtlSeconds = 60 * 60;
export let portalOAuthClientRegistrationsPerMinuteLimit = 10;
export let portalOAuthClientRegistrationsPerHourLimit = 20;

let getPortalRefreshTokenExpiry = () => addSeconds(new Date(), portalRefreshTokenTtlSeconds);
let getPortalAccessTokenExpiry = () => addSeconds(new Date(), portalAccessTokenTtlSeconds);
let portalOAuthClientRegistrationRateLimitError = createError({
  status: 429,
  code: 'rate_limit_exceeded',
  message: 'Too many portal OAuth client registrations from this IP address',
  hint: 'Portal OAuth client registrations are limited to 10 per minute and 20 per hour.'
});

let ensurePendingPortalOAuthAuthorization = (
  portalOAuthAuthorization: Pick<PortalAuthAttempt, 'status'>
) => {
  if (portalOAuthAuthorization.status != 'pending') {
    throw new ServiceError(
      preconditionFailedError({
        message: 'This portal OAuth authorization is no longer pending.'
      })
    );
  }
};

let ensureAttemptNotExpired = (attempt: Pick<PortalOAuthAuthorization, 'expiresAt'>) => {
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

class ConsumerOAuthServiceImpl {
  async resolvePortalRoute(d: { portalId: string; magicMcpTargetId?: string }) {
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
      }`
    };
  }

  async registerPortalOAuthClient(d: {
    portal: Awaited<ReturnType<typeof portalService.getPortalPublic>>;
    magicMcpTarget: MagicMcpResolvedTarget | null;
    input: {
      clientName: string;
      redirectUris: string[];
      registrationIp: string;
      tokenEndpointAuthMethod?: 'client_secret_basic' | 'client_secret_post' | 'none';
    };
  }) {
    for (let redirectUri of d.input.redirectUris) {
      validateUrlString(redirectUri, 'redirect_uri');
    }
    validatePortalRedirectUrisAgainstAllowedFilters({
      redirectUris: d.input.redirectUris,
      allowedRedirectUrlFilters: getPortalAllowedRedirectUrlFilters(
        d.portal.allowedRedirectUrlFilters
      )
    });

    let tokenEndpointAuthMethod = d.input.tokenEndpointAuthMethod ?? 'client_secret_basic';
    let clientSecret =
      tokenEndpointAuthMethod == 'none' ? null : await ID.generateId('portalAuthClientSecret');

    return await withTransaction(async db => {
      let now = new Date();
      let registrationsPerMinute = await db.portalAuthClient.count({
        where: {
          registrationIp: d.input.registrationIp,
          createdAt: {
            gte: addMinutes(now, -1)
          }
        }
      });
      if (registrationsPerMinute >= portalOAuthClientRegistrationsPerMinuteLimit) {
        throw new ServiceError(portalOAuthClientRegistrationRateLimitError);
      }

      let registrationsPerHour = await db.portalAuthClient.count({
        where: {
          registrationIp: d.input.registrationIp,
          createdAt: {
            gte: addMinutes(now, -60)
          }
        }
      });
      if (registrationsPerHour >= portalOAuthClientRegistrationsPerHourLimit) {
        throw new ServiceError(portalOAuthClientRegistrationRateLimitError);
      }

      return await db.portalAuthClient.create({
        data: {
          id: await ID.generateId('portalAuthClient'),
          portalOid: d.portal.oid,
          magicMcpServerOid:
            d.magicMcpTarget?.type === 'server' ? d.magicMcpTarget.target.oid : null,
          magicMcpEndpointOid:
            d.magicMcpTarget?.type === 'endpoint' ? d.magicMcpTarget.target.oid : null,
          name: d.input.clientName,
          redirectUris: d.input.redirectUris,
          registrationIp: d.input.registrationIp,
          clientId: await ID.generateId('portalAuthClientId'),
          clientSecret,
          tokenEndpointAuthMethod,
          expiresAt: addDays(new Date(), 30)
        },
        include: portalAuthClientInclude
      });
    });
  }

  async getPortalOAuthRegistration(d: {
    portal: Awaited<ReturnType<typeof portalService.getPortalPublic>>;
    magicMcpTarget: MagicMcpResolvedTarget | null;
    registrationId: string;
  }) {
    let registration = await db.portalAuthClient.findFirst({
      where: {
        id: d.registrationId,
        portalOid: d.portal.oid,
        magicMcpServerOid:
          d.magicMcpTarget?.type === 'server' ? d.magicMcpTarget.target.oid : null,
        magicMcpEndpointOid:
          d.magicMcpTarget?.type === 'endpoint' ? d.magicMcpTarget.target.oid : null
      },
      include: portalAuthClientInclude
    });

    return registration;
  }

  async createPortalOAuthAuthorization(d: {
    portal: Awaited<ReturnType<typeof portalService.getPortalPublic>>;
    magicMcpTarget: MagicMcpResolvedTarget | null;
    input: {
      responseType?: string;
      clientId?: string;
      redirectUri?: string;
      codeChallenge?: string;
      codeChallengeMethod?: string;
      state?: string;
    };
  }) {
    if (!d.input.responseType) {
      throw new ServiceError(
        badRequestError({
          message: 'response_type is required',
          oauth: {
            error: 'invalid_request',
            errorMessage: 'response_type is required'
          }
        })
      );
    }

    if (d.input.responseType != 'code') {
      throw new ServiceError(
        badRequestError({
          message: 'Only response_type=code is supported',
          oauth: {
            error: 'unsupported_response_type',
            errorMessage: 'Only response_type=code is supported'
          }
        })
      );
    }

    if (!d.input.clientId) {
      throw new ServiceError(
        badRequestError({
          message: 'client_id is required',
          oauth: {
            error: 'invalid_request',
            errorMessage: 'client_id is required'
          }
        })
      );
    }

    if (!d.input.redirectUri) {
      throw new ServiceError(
        badRequestError({
          message: 'redirect_uri is required',
          oauth: {
            error: 'invalid_request',
            errorMessage: 'redirect_uri is required'
          }
        })
      );
    }

    if (
      d.input.codeChallengeMethod &&
      !['S256', 's256', 'none'].includes(d.input.codeChallengeMethod)
    ) {
      throw new ServiceError(
        badRequestError({
          message: 'Only S256 PKCE challenges are supported',
          oauth: {
            error: 'invalid_request',
            errorMessage: 'Only S256 PKCE challenges are supported'
          }
        })
      );
    }

    let normalizedCodeChallengeMethod =
      d.input.codeChallengeMethod == 'S256' || d.input.codeChallengeMethod == 's256'
        ? ('s256' as const)
        : d.input.codeChallenge
          ? ('s256' as const)
          : ('none' as const);

    if (normalizedCodeChallengeMethod == 's256' && !d.input.codeChallenge) {
      throw new ServiceError(
        badRequestError({
          message: 'code_challenge is required when using PKCE',
          oauth: {
            error: 'invalid_request',
            errorMessage: 'code_challenge is required when using PKCE'
          }
        })
      );
    }

    let client = await this.getPortalAuthClient({
      clientId: d.input.clientId,
      portalOid: d.portal.oid,
      magicMcpServerOid:
        d.magicMcpTarget?.type === 'server' ? d.magicMcpTarget.target.oid : undefined,
      magicMcpEndpointOid:
        d.magicMcpTarget?.type === 'endpoint' ? d.magicMcpTarget.target.oid : undefined
    });
    validateRedirectUri(d.input.redirectUri, client.redirectUris);

    let attempt = await db.portalAuthAttempt.create({
      data: {
        id: await ID.generateId('portalAuthAttempt'),
        portalAuthClientOid: client.oid,
        status: 'pending',
        redirectUri: d.input.redirectUri,
        state: d.input.state,
        authorizationCode: generateCustomId('prtl_oatc_', 35),
        codeChallengeMethod: normalizedCodeChallengeMethod,
        codeChallenge: d.input.codeChallenge,
        expiresAt: addDays(new Date(), 7)
      }
    });

    let redirectUrl = new URL(portalService.getPortalHost({ portal: d.portal }).host);
    let basePath = redirectUrl.pathname.replace(/\/+$/, '');
    redirectUrl.pathname = `${basePath}/oauth/authorize/${attempt.id}`.replace(/\/{2,}/g, '/');
    redirectUrl.search = '';
    redirectUrl.hash = '';

    return {
      attempt,
      redirectUrl: redirectUrl.toString()
    };
  }

  async exchangePortalOAuthToken(d: {
    portal: Awaited<ReturnType<typeof portalService.getPortalPublic>>;
    magicMcpTarget: MagicMcpResolvedTarget | null;
    input: {
      clientId?: string;
      clientSecret?: string;
      grantType?: string;
      code?: string;
      redirectUri?: string;
      codeVerifier?: string;
      refreshToken?: string;
    };
  }) {
    if (!d.input.grantType) {
      throw new ServiceError(
        badRequestError({
          message: 'grant_type is required',
          oauth: {
            error: 'invalid_request',
            errorMessage: 'grant_type is required'
          }
        })
      );
    }

    if (!d.input.clientId) {
      throw new ServiceError(
        badRequestError({
          message: 'client_id is required',
          oauth: {
            error: 'invalid_request',
            errorMessage: 'client_id is required'
          }
        })
      );
    }

    let client = await this.getPortalAuthClient({
      clientId: d.input.clientId,
      portalOid: d.portal.oid,
      magicMcpServerOid:
        d.magicMcpTarget?.type === 'server' ? d.magicMcpTarget.target.oid : undefined,
      magicMcpEndpointOid:
        d.magicMcpTarget?.type === 'endpoint' ? d.magicMcpTarget.target.oid : undefined
    });
    this.validateClientSecret({
      client,
      clientSecret: d.input.clientSecret
    });

    if (d.input.grantType == 'authorization_code') {
      if (!d.input.code) {
        throw new ServiceError(
          badRequestError({
            message: 'code is required for the authorization_code grant',
            oauth: {
              error: 'invalid_request',
              errorMessage: 'code is required for the authorization_code grant'
            }
          })
        );
      }

      if (!d.input.redirectUri) {
        throw new ServiceError(
          badRequestError({
            message: 'redirect_uri is required for the authorization_code grant',
            oauth: {
              error: 'invalid_request',
              errorMessage: 'redirect_uri is required for the authorization_code grant'
            }
          })
        );
      }

      return await this.exchangeAuthorizationCodeToken({
        portal: d.portal,
        magicMcpTarget: d.magicMcpTarget,
        client,
        code: d.input.code,
        redirectUri: d.input.redirectUri,
        codeVerifier: d.input.codeVerifier
      });
    }

    if (d.input.grantType == 'refresh_token') {
      if (!d.input.refreshToken) {
        throw new ServiceError(
          badRequestError({
            message: 'refresh_token is required for the refresh_token grant',
            oauth: {
              error: 'invalid_request',
              errorMessage: 'refresh_token is required for the refresh_token grant'
            }
          })
        );
      }

      return await this.exchangeRefreshToken({
        portal: d.portal,
        magicMcpTarget: d.magicMcpTarget,
        client,
        refreshToken: d.input.refreshToken
      });
    }

    throw new ServiceError(
      badRequestError({
        message: `Unsupported grant type: ${d.input.grantType}`,
        oauth: {
          error: 'unsupported_grant_type',
          errorMessage: `Unsupported grant type: ${d.input.grantType}`
        }
      })
    );
  }

  async getPortalOAuthClientForConsumer(d: {
    instance: Instance;
    consumerSurface: ConsumerSurface;
    portalAuthClientId: string;
  }) {
    let portalOAuthClient = await db.portalAuthClient.findFirst({
      where: {
        id: d.portalAuthClientId,
        portal: {
          instanceOid: d.instance.oid,
          surfaceOid: d.consumerSurface.oid
        }
      },
      include: portalAuthClientInclude
    });

    if (!portalOAuthClient) {
      throw new ServiceError(notFoundError('portal.oauth_client'));
    }

    return portalOAuthClient;
  }

  async getPortalOAuthAuthorizationForConsumer(d: {
    instance: Instance;
    consumerSurface: ConsumerSurface;
    consumerProfile: ConsumerProfile;
    portalAuthAttemptId: string;
  }) {
    let portalOAuthAuthorization = await db.portalAuthAttempt.findFirst({
      where: {
        id: d.portalAuthAttemptId,
        portalAuthClient: {
          portal: {
            instanceOid: d.instance.oid,
            surfaceOid: d.consumerSurface.oid
          }
        }
      },
      include: portalAuthAttemptInclude
    });

    if (!portalOAuthAuthorization) {
      throw new ServiceError(notFoundError('portal.oauth_authorization'));
    }

    if (
      portalOAuthAuthorization.consumerProfile &&
      portalOAuthAuthorization.consumerProfile.oid != d.consumerProfile.oid
    ) {
      throw new ServiceError(
        preconditionFailedError({
          message: 'This portal OAuth authorization belongs to a different consumer profile.'
        })
      );
    }

    return portalOAuthAuthorization;
  }

  async acceptPortalOAuthAuthorization(d: {
    portalOAuthAuthorization: PortalOAuthAuthorization;
    consumerProfile: ConsumerProfile;
  }) {
    ensurePendingPortalOAuthAuthorization(d.portalOAuthAuthorization);

    if (
      !d.portalOAuthAuthorization.portalAuthClient.magicMcpServerOid &&
      !d.portalOAuthAuthorization.portalAuthClient.magicMcpEndpointOid &&
      !d.portalOAuthAuthorization.magicMcpEndpointOid
    ) {
      throw new ServiceError(
        preconditionFailedError({
          message:
            'Select at least one Magic MCP server before approving this portal OAuth authorization.'
        })
      );
    }

    let now = new Date();
    return await db.portalAuthAttempt.update({
      where: {
        id: d.portalOAuthAuthorization.id
      },
      data: {
        status: 'authorized',
        consumerProfileOid: d.consumerProfile.oid,
        authorizedAt: now,
        deniedAt: null,
        authorizationCode: d.portalOAuthAuthorization.authorizationCode ?? crypto.randomUUID(),
        authorizationCodeExpiresAt: addMinutes(now, 10)
      },
      include: portalAuthAttemptInclude
    });
  }

  async connectPortalOAuthAuthorizationToMagicMcpEndpoint(d: {
    portalOAuthAuthorization: PortalOAuthAuthorization;
    instance: Instance;
    accessTags?: AnyAccessTagSelector;
    consumerProfile: ConsumerProfile;
    magicMcpEndpointId: string;
  }) {
    ensurePendingPortalOAuthAuthorization(d.portalOAuthAuthorization);

    let magicMcpEndpoint = await magicMcpEndpointService.getMagicMcpEndpointById({
      magicMcpEndpointId: d.magicMcpEndpointId,
      instance: d.instance,
      accessTags: d.accessTags
    });

    if (magicMcpEndpoint.consumerProfileOid != d.consumerProfile.oid) {
      throw new ServiceError(
        preconditionFailedError({
          message:
            'You can only link this portal OAuth authorization to a magic MCP endpoint you own.'
        })
      );
    }

    if (magicMcpEndpoint.servers.length == 0) {
      throw new ServiceError(
        preconditionFailedError({
          message:
            'Add at least one Magic MCP server to the endpoint before linking it to this portal OAuth authorization.'
        })
      );
    }

    return await db.portalAuthAttempt.update({
      where: {
        id: d.portalOAuthAuthorization.id
      },
      data: {
        consumerProfileOid: d.consumerProfile.oid,
        magicMcpEndpointOid: magicMcpEndpoint.oid
      },
      include: portalAuthAttemptInclude
    });
  }

  async rejectPortalOAuthAuthorization(d: {
    portalOAuthAuthorization: PortalOAuthAuthorization;
    consumerProfile: ConsumerProfile;
  }) {
    ensurePendingPortalOAuthAuthorization(d.portalOAuthAuthorization);

    return await db.portalAuthAttempt.update({
      where: {
        id: d.portalOAuthAuthorization.id
      },
      data: {
        status: 'denied',
        consumerProfileOid:
          d.portalOAuthAuthorization.consumerProfileOid ?? d.consumerProfile.oid,
        deniedAt: new Date()
      },
      include: portalAuthAttemptInclude
    });
  }

  private async getPortalAuthClient(d: {
    clientId: string;
    portalOid: bigint;
    magicMcpServerOid?: bigint;
    magicMcpEndpointOid?: bigint;
  }) {
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
  }

  private validateClientSecret(d: {
    client: Awaited<ReturnType<ConsumerOAuthServiceImpl['getPortalAuthClient']>>;
    clientSecret?: string;
  }) {
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
  }

  private async exchangeAuthorizationCodeToken(d: {
    portal: Awaited<ReturnType<typeof portalService.getPortalPublic>>;
    magicMcpTarget: MagicMcpResolvedTarget | null;
    client: Awaited<ReturnType<ConsumerOAuthServiceImpl['getPortalAuthClient']>>;
    code: string;
    redirectUri: string;
    codeVerifier?: string;
  }) {
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

    if (
      !attempt.authorizationCodeExpiresAt ||
      attempt.authorizationCodeExpiresAt < new Date()
    ) {
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

    let accessToken = await this.ensureLinkedAccessToken({
      attempt,
      portal: d.portal,
      magicMcpTarget: d.magicMcpTarget,
      createIfMissing: true
    });

    let refreshToken = generateCustomId('prtl_oatre_', 35);
    let expiresAt = getPortalRefreshTokenExpiry();
    let updatedAttempt = await db.portalAuthAttempt.update({
      where: {
        id: attempt.id
      },
      data: {
        status: 'active',
        authorizationCodeUsedAt: new Date(),
        refreshToken,
        expiresAt
      }
    });

    return {
      accessToken: accessToken.secret,
      refreshToken: updatedAttempt.refreshToken!
    };
  }

  private async exchangeRefreshToken(d: {
    portal: Awaited<ReturnType<typeof portalService.getPortalPublic>>;
    magicMcpTarget: MagicMcpResolvedTarget | null;
    client: Awaited<ReturnType<ConsumerOAuthServiceImpl['getPortalAuthClient']>>;
    refreshToken: string;
  }) {
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

    let accessToken = await this.ensureLinkedAccessToken({
      attempt,
      portal: d.portal,
      magicMcpTarget: d.magicMcpTarget,
      allowExpired: true
    });

    let expiresAt = getPortalRefreshTokenExpiry();
    let rotatedAccessToken = await magicMcpTokenService.rotateMagicMcpTokenSecret({
      token: accessToken,
      expiresAt: getPortalAccessTokenExpiry()
    });
    let nextRefreshToken = generateCustomId('prtl_oatre_', 35);
    let updatedAttempt = await db.portalAuthAttempt.update({
      where: {
        id: attempt.id
      },
      data: {
        refreshToken: nextRefreshToken,
        expiresAt
      }
    });

    return {
      accessToken: rotatedAccessToken.secret,
      refreshToken: updatedAttempt.refreshToken!
    };
  }

  private async ensureLinkedAccessToken(d: {
    attempt: PortalOAuthAuthorization;
    portal: Awaited<ReturnType<typeof portalService.getPortalPublic>>;
    magicMcpTarget: MagicMcpResolvedTarget | null;
    createIfMissing?: boolean;
    allowExpired?: boolean;
  }) {
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

      if (
        d.attempt.magicMcpToken.expiresAt &&
        d.attempt.magicMcpToken.expiresAt < new Date() &&
        !d.allowExpired
      ) {
        throw new ServiceError(
          badRequestError({
            message: 'The linked magic MCP token has expired',
            oauth: {
              error: 'invalid_grant',
              errorMessage: 'The linked magic MCP token has expired'
            }
          })
        );
      }

      return d.attempt.magicMcpToken;
    }

    if (!d.createIfMissing) {
      throw new ServiceError(
        badRequestError({
          message: 'The portal authorization is missing a linked magic MCP token',
          oauth: {
            error: 'invalid_grant',
            errorMessage: 'The portal authorization is missing a linked magic MCP token'
          }
        })
      );
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
        expiresAt: getPortalAccessTokenExpiry(),
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
  }
}

export let consumerOAuthService = Service.create(
  'consumerOAuthService',
  () => new ConsumerOAuthServiceImpl()
).build();
