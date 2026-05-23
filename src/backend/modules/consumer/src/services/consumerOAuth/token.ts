import {
  badRequestError,
  notFoundError,
  ServiceError,
  unauthorizedError
} from '@mtsrc/error';
import { generateCustomId } from '@mtsrc/id';
import { Service } from '@mtsrc/service';
import {
  db,
  Organization,
  SkillPlugin,
  type ConsumerSurface,
  type Instance
} from '@metorial/db';
import { magicMcpTokenService, type MagicMcpResolvedTarget } from '@metorial/module-magic';
import { grantConsumerOwnedMagicMcpTokenAccess } from '../../lib/magicMcpTokenAccess';
import { createCodeChallenge, urlsMatch } from '../../lib/oauth';
import { consumerIntegrationService } from '../consumerEntities/consumerIntegration';
import { consumerProfileService } from '../consumers/consumerProfile';
import { portalService } from '../portal';
import {
  ensureAttemptNotExpired,
  ensureSkillPluginMatchesEndpoint,
  getConsumerAuthAccessTokenExpiry,
  getConsumerAuthClient,
  getConsumerAuthClientPlugin,
  getConsumerAuthClientSurface,
  getConsumerAuthRefreshTokenExpiry,
  resolveConsumerSurface
} from './_helpers';
import {
  consumerAuthAttemptInclude,
  consumerAuthClientInclude,
  ConsumerOAuthAuthorization,
  ConsumerOAuthClient,
  ConsumerSurfaceWithContext
} from './_types';

class ConsumerOAuthTokenService {
  async exchangeConsumerAuthToken(d: {
    portal?: Awaited<ReturnType<typeof portalService.getPortalPublic>>;
    consumerSurface?: ConsumerSurface;
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
    this.validateTokenRequestBasics(d.input);

    let consumerSurface = resolveConsumerSurface(d);
    if (!consumerSurface) {
      throw new ServiceError(notFoundError('consumer.surface'));
    }

    let client = await getConsumerAuthClient({
      clientId: d.input.clientId!,
      consumerSurfaceOid: consumerSurface.oid,
      skillPluginOid: undefined,
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
      this.requireAuthorizationCodeGrantInput(d.input);

      return await this.exchangeAuthorizationCodeToken({
        portal: d.portal,
        consumerSurface,
        magicMcpTarget: d.magicMcpTarget,
        client,
        code: d.input.code!,
        redirectUri: d.input.redirectUri!,
        codeVerifier: d.input.codeVerifier
      });
    }

    if (d.input.grantType == 'refresh_token') {
      this.requireRefreshTokenGrantInput(d.input);

      return await this.exchangeRefreshToken({
        portal: d.portal,
        consumerSurface,
        magicMcpTarget: d.magicMcpTarget,
        client,
        refreshToken: d.input.refreshToken!
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

  async exchangeSkillPluginConsumerAuthToken(d: {
    skillPlugin: SkillPlugin;
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
    this.validateTokenRequestBasics(d.input);

    let client = await this.getSkillPluginConsumerAuthClient({
      skillPlugin: d.skillPlugin,
      clientId: d.input.clientId!
    });
    this.validateClientSecret({
      client,
      clientSecret: d.input.clientSecret
    });

    if (d.input.grantType == 'authorization_code') {
      this.requireAuthorizationCodeGrantInput(d.input);

      return await this.exchangeAuthorizationCodeToken({
        consumerSurface: await this.getConsumerSurfaceForAuthorizationCode({
          client,
          code: d.input.code!
        }),
        magicMcpTarget: null,
        client,
        code: d.input.code!,
        redirectUri: d.input.redirectUri!,
        codeVerifier: d.input.codeVerifier
      });
    }

    if (d.input.grantType == 'refresh_token') {
      this.requireRefreshTokenGrantInput(d.input);

      return await this.exchangeRefreshToken({
        consumerSurface: await this.getConsumerSurfaceForRefreshToken({
          client,
          refreshToken: d.input.refreshToken!
        }),
        magicMcpTarget: null,
        client,
        refreshToken: d.input.refreshToken!
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

  private validateTokenRequestBasics(input: { grantType?: string; clientId?: string }) {
    if (!input.grantType) {
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

    if (!input.clientId) {
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
  }

  private requireAuthorizationCodeGrantInput(input: { code?: string; redirectUri?: string }) {
    if (!input.code) {
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

    if (!input.redirectUri) {
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
  }

  private requireRefreshTokenGrantInput(input: { refreshToken?: string }) {
    if (!input.refreshToken) {
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
  }

  private async getSkillPluginConsumerAuthClient(d: {
    skillPlugin: SkillPlugin;
    clientId: string;
  }) {
    let client = await db.consumerAuthClient.findFirst({
      where: {
        clientId: d.clientId,
        skillPluginOid: d.skillPlugin.oid,
        instanceOid: d.skillPlugin.instanceOid,
        organizationOid: d.skillPlugin.organizationOid,
        magicMcpServerOid: null,
        magicMcpEndpointOid: null
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
  }

  private async getConsumerSurfaceForAuthorizationCode(d: {
    client: ConsumerOAuthClient;
    code: string;
  }): Promise<ConsumerSurfaceWithContext> {
    let attempt = await db.consumerAuthAttempt.findFirst({
      where: {
        consumerAuthClientOid: d.client.oid,
        authorizationCode: d.code
      },
      include: {
        consumerProfile: {
          include: {
            surface: {
              include: {
                portal: true,
                organization: true,
                instance: {
                  include: {
                    project: true,
                    organization: true
                  }
                }
              }
            }
          }
        }
      }
    });

    let surface = attempt?.consumerProfile?.surface;
    if (!surface) {
      let fallback = getConsumerAuthClientSurface(d.client);
      if (!fallback) throw new ServiceError(notFoundError('consumer.surface'));
      return fallback as ConsumerSurfaceWithContext;
    }

    return surface;
  }

  private async getConsumerSurfaceForRefreshToken(d: {
    client: ConsumerOAuthClient;
    refreshToken: string;
  }): Promise<ConsumerSurfaceWithContext> {
    let attempt = await db.consumerAuthAttempt.findFirst({
      where: {
        consumerAuthClientOid: d.client.oid,
        refreshToken: d.refreshToken
      },
      include: {
        consumerProfile: {
          include: {
            surface: {
              include: {
                portal: true,
                organization: true,
                instance: {
                  include: {
                    project: true,
                    organization: true
                  }
                }
              }
            }
          }
        }
      }
    });

    let surface = attempt?.consumerProfile?.surface;
    if (!surface) {
      let fallback = getConsumerAuthClientSurface(d.client);
      if (!fallback) throw new ServiceError(notFoundError('consumer.surface'));
      return fallback as ConsumerSurfaceWithContext;
    }

    return surface;
  }

  private validateClientSecret(d: { client: ConsumerOAuthClient; clientSecret?: string }) {
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
    portal?: Awaited<ReturnType<typeof portalService.getPortalPublic>>;
    consumerSurface: ConsumerSurface;
    magicMcpTarget: MagicMcpResolvedTarget | null;
    client: ConsumerOAuthClient;
    code: string;
    redirectUri: string;
    codeVerifier?: string;
  }) {
    let attempt = await db.consumerAuthAttempt.findFirst({
      where: {
        consumerAuthClientOid: d.client.oid,
        authorizationCode: d.code
      },
      include: consumerAuthAttemptInclude
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
      consumerSurface: d.consumerSurface,
      magicMcpTarget: d.magicMcpTarget,
      createIfMissing: true
    });

    let refreshToken = generateCustomId('prtl_oatre_', 35);
    let expiresAt = getConsumerAuthRefreshTokenExpiry();
    let updatedAttempt = await db.consumerAuthAttempt.update({
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
    portal?: Awaited<ReturnType<typeof portalService.getPortalPublic>>;
    consumerSurface: ConsumerSurface;
    magicMcpTarget: MagicMcpResolvedTarget | null;
    client: ConsumerOAuthClient;
    refreshToken: string;
  }) {
    let attempt = await db.consumerAuthAttempt.findFirst({
      where: {
        consumerAuthClientOid: d.client.oid,
        refreshToken: d.refreshToken
      },
      include: consumerAuthAttemptInclude
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
      consumerSurface: d.consumerSurface,
      magicMcpTarget: d.magicMcpTarget,
      allowExpired: true
    });

    let expiresAt = getConsumerAuthRefreshTokenExpiry();
    let rotatedAccessToken = await magicMcpTokenService.rotateMagicMcpTokenSecret({
      token: accessToken,
      expiresAt: getConsumerAuthAccessTokenExpiry()
    });
    let nextRefreshToken = generateCustomId('prtl_oatre_', 35);
    let updatedAttempt = await db.consumerAuthAttempt.update({
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
    attempt: ConsumerOAuthAuthorization;
    portal?: Awaited<ReturnType<typeof portalService.getPortalPublic>>;
    consumerSurface: ConsumerSurface;
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
          message: 'The authorization is missing a linked magic MCP token',
          oauth: {
            error: 'invalid_grant',
            errorMessage: 'The authorization is missing a linked magic MCP token'
          }
        })
      );
    }

    if (!d.attempt.consumerProfile) {
      throw new ServiceError(
        badRequestError({
          message: 'The authorization is missing a consumer profile',
          oauth: {
            error: 'invalid_grant',
            errorMessage: 'The authorization is missing a consumer profile'
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
          message: 'The authorization is not linked to a magic MCP server or endpoint',
          oauth: {
            error: 'invalid_grant',
            errorMessage: 'The authorization is not linked to a magic MCP server or endpoint'
          }
        })
      );
    }

    if (magicMcpEndpoint) {
      ensureSkillPluginMatchesEndpoint({
        skillPlugin: getConsumerAuthClientPlugin(d.attempt.consumerAuthClient),
        magicMcpEndpoint
      });
      let isManaged = magicMcpEndpoint.consumerProfileOid !== d.attempt.consumerProfile.oid;

      await consumerIntegrationService.linkConsumerAuthAttemptToConsumerIntegrationEndpoint({
        consumerAuthAttempt: d.attempt,
        consumerProfile: d.attempt.consumerProfile,
        magicMcpEndpoint,
        isManaged
      });
    }

    let nonPortalConsumerSurface = d.consumerSurface as ConsumerSurface & {
      instance: Instance;
      organization: Organization;
    };

    let magicMcpToken = await magicMcpTokenService.createMagicMcpToken({
      instance: d.portal?.instance ?? nonPortalConsumerSurface.instance,
      input: {
        name: d.attempt.consumerAuthClient.name,
        description: `Access token for ${d.attempt.consumerAuthClient.name} (via ${d.portal ? d.portal.name : d.consumerSurface.name})`,
        expiresAt: getConsumerAuthAccessTokenExpiry(),
        magicMcpServer,
        magicMcpEndpoint,
        skillPlugin:
          (magicMcpEndpoint as any)?.skillPlugin ??
          d.attempt.skillPlugin ??
          d.attempt.consumerAuthClient.skillPlugin
      }
    });

    let consumerGroups = await consumerProfileService.getGroupsForProfile({
      consumerProfile: d.attempt.consumerProfile
    });

    await grantConsumerOwnedMagicMcpTokenAccess({
      organization: d.portal?.organization ?? nonPortalConsumerSurface.organization,
      consumerProfile: d.attempt.consumerProfile,
      consumerGroups,
      magicMcpToken
    });

    await db.consumerAuthAttempt.update({
      where: {
        id: d.attempt.id
      },
      data: {
        magicMcpTokenOid: magicMcpToken.oid,
        skillPluginOid:
          d.attempt.skillPluginOid ??
          d.attempt.consumerAuthClient.skillPluginOid ??
          magicMcpEndpoint?.skillPluginOid
      }
    });

    return magicMcpToken;
  }
}

export let consumerOAuthTokenService = Service.create(
  'consumerOAuthTokenService',
  () => new ConsumerOAuthTokenService()
).build();
