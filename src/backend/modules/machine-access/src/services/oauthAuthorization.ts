import {
  badRequestError,
  forbiddenError,
  notFoundError,
  ServiceError,
  unauthorizedError
} from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { Context } from '@metorial/context';
import {
  addAfterTransactionHook,
  db,
  ID,
  MachineAccess,
  OAuthApplication,
  OAuthApplicationType,
  OAuthAuthorization,
  OAuthAuthorizationRequest,
  OAuthAuthorizationRequestChallengeMethod,
  OAuthAuthorizationStatus,
  OAuthInstallation,
  Organization,
  OrganizationActor,
  OrganizationMember,
  Prisma,
  User,
  withTransaction
} from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { generateCode, generateCustomId } from '@metorial/id';
import { organizationService } from '@metorial/module-organization';
import { addMinutes, addSeconds, differenceInSeconds } from 'date-fns';
import {
  ensureAuthorizationRequestPending,
  ensureAuthorizationUsable,
  ensureScopesAllowed,
  ensureTokenRefreshable
} from '../lib/oauthAuthorizationGuards';
import { createCodeChallenge } from '../lib/oauthAuthorizationPkce';
import {
  ACCESS_TOKEN_MAX_TTL_SECONDS,
  ACCESS_TOKEN_MIN_TTL_SECONDS,
  createIssuedOAuthTokenValues,
  DEVICE_REQUEST_TTL_MINUTES,
  INTERACTIVE_REQUEST_TTL_MINUTES
} from '../lib/oauthAuthorizationTokens';
import { validateOAuthScopes } from '../lib/oauthScopeValidation';
import { urlsMatch, validateRedirectUri } from '../lib/oauthUrls';
import { cliDeviceService } from './cliDevice';
import { machineAccessInclude } from './machineAccessAuth';
import { oauthApplicationService } from './oauthApplication';
import {
  installationInclude,
  oauthAuthorizationInstallationService
} from './oauthAuthorizationInstallation';

class OAuthAuthorizationService {
  private assertApplicationSupportsAuthorizationRequest(d: {
    oauthApplication: OAuthApplication;
    requestType: 'interactive' | 'device_code';
    allowCliAuth?: boolean;
  }) {
    let allowedTypes: OAuthApplicationType[] =
      d.requestType == 'interactive'
        ? ['user_facing']
        : d.allowCliAuth
          ? ['user_facing', 'cli_auth']
          : ['user_facing'];

    if (allowedTypes.includes(d.oauthApplication.type)) return;

    if (d.requestType == 'interactive') {
      throw new ServiceError(
        forbiddenError({
          message: 'Only user-facing oauth applications support interactive authorization',
          oauth: {
            error: 'unauthorized_client',
            errorMessage:
              'Only user-facing oauth applications support interactive authorization'
          }
        })
      );
    }

    throw new ServiceError(
      forbiddenError({
        message: 'This oauth application does not support device-code authorization',
        oauth: {
          error: 'unauthorized_client',
          errorMessage: 'This oauth application does not support device-code authorization'
        }
      })
    );
  }

  async checkDeviceCodeAuthorizationRequest(d: { clientId: string; deviceCode: string }) {
    return await withTransaction(async db => {
      let oauthAuthorizationRequest = await db.oAuthAuthorizationRequest.findFirst({
        where: { deviceCode: d.deviceCode },
        include: authorizationRequestInclude
      });

      if (
        !oauthAuthorizationRequest ||
        oauthAuthorizationRequest.oauthApplication.clientId != d.clientId ||
        oauthAuthorizationRequest.expiresAt < new Date()
      ) {
        throw new ServiceError(
          unauthorizedError({
            message: 'Invalid device code',
            oauth: {
              error: 'invalid_grant',
              errorMessage: 'Invalid device code'
            }
          })
        );
      }

      if (oauthAuthorizationRequest.type != 'device_code') {
        throw new ServiceError(
          badRequestError({
            message: 'Authorization request is not a device-code flow'
          })
        );
      }

      if (
        oauthAuthorizationRequest.lastPollAt &&
        differenceInSeconds(new Date(), oauthAuthorizationRequest.lastPollAt) < 4
      ) {
        throw new ServiceError(
          badRequestError({
            message: 'Device code is being polled too frequently',
            oauth: {
              error: 'slow_down',
              errorMessage: 'Device code is being polled too frequently'
            }
          })
        );
      }

      oauthAuthorizationRequest = await db.oAuthAuthorizationRequest.update({
        where: { oid: oauthAuthorizationRequest.oid },
        data: {
          lastPollAt: new Date()
        },
        include: authorizationRequestInclude
      });

      if (oauthAuthorizationRequest.status == 'denied') {
        return {
          status: 'denied' as const,
          oauthAuthorizationRequest
        };
      }

      if (
        oauthAuthorizationRequest.status == 'accepted' &&
        oauthAuthorizationRequest.oauthAuthorization
      ) {
        return {
          status: 'accepted' as const,
          oauthAuthorizationRequest
        };
      }

      if (oauthAuthorizationRequest.status == 'consumed') {
        return {
          status: 'consumed' as const,
          oauthAuthorizationRequest
        };
      }

      return {
        status: 'pending' as const,
        oauthAuthorizationRequest
      };
    });
  }

  async exchangeOAuthToken(d: {
    context: Context;
    input:
      | {
          grantType: 'authorization_code';
          clientId: string;
          code: string;
          redirectUri: string;
          codeVerifier?: string;
        }
      | {
          grantType: 'urn:ietf:params:oauth:grant-type:device_code' | 'device_code';
          clientId: string;
          deviceCode: string;
        }
      | {
          grantType: 'client_credentials';
          clientId: string;
          clientSecret: string;
          scopes?: string[];
          expiresIn?: number;
        }
      | {
          grantType: 'refresh_token';
          clientId: string;
          refreshToken: string;
        };
  }) {
    if (d.input.grantType == 'authorization_code') {
      return await this.exchangeAuthorizationCodeToken(d.input);
    }

    if (
      d.input.grantType == 'urn:ietf:params:oauth:grant-type:device_code' ||
      d.input.grantType == 'device_code'
    ) {
      return await this.exchangeDeviceCodeToken(d.input);
    }

    if (d.input.grantType == 'client_credentials') {
      return await this.exchangeClientCredentialsToken({
        ...d.input,
        context: d.context
      });
    }

    if (d.input.grantType == 'refresh_token') {
      return await this.exchangeRefreshToken({
        clientId: d.input.clientId,
        refreshToken: d.input.refreshToken
      });
    }

    throw new ServiceError(
      badRequestError({
        message: 'Unsupported grant type',
        oauth: {
          error: 'unsupported_grant_type',
          errorMessage: 'Unsupported grant type'
        }
      })
    );
  }

  private async exchangeAuthorizationCodeToken(d: {
    clientId: string;
    code: string;
    redirectUri: string;
    codeVerifier?: string;
  }) {
    let oauthAuthorizationRequest = await db.oAuthAuthorizationRequest.findFirst({
      where: { code: d.code },
      include: authorizationRequestInclude
    });
    if (
      !oauthAuthorizationRequest ||
      oauthAuthorizationRequest.status != 'accepted' ||
      oauthAuthorizationRequest.oauthApplication.clientId != d.clientId ||
      !oauthAuthorizationRequest.oauthAuthorization
    ) {
      throw new ServiceError(
        unauthorizedError({
          message: 'Invalid authorization code',
          oauth: {
            error: 'invalid_grant',
            errorMessage: 'Invalid authorization code'
          }
        })
      );
    }

    if (oauthAuthorizationRequest.expiresAt < new Date()) {
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

    if (oauthAuthorizationRequest.type != 'interactive') {
      throw new ServiceError(
        badRequestError({
          message: 'Authorization request cannot be used for this grant type'
        })
      );
    }

    if (!urlsMatch(oauthAuthorizationRequest.redirectUri!, d.redirectUri)) {
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

    if (oauthAuthorizationRequest.codeChallengeMethod == 's256') {
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
      if (codeChallenge != oauthAuthorizationRequest.codeChallenge) {
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
    }

    if (oauthAuthorizationRequest.codeChallengeMethod == 'none' && d.codeVerifier) {
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

    let oauthAuthorization = oauthAuthorizationRequest.oauthAuthorization;
    ensureAuthorizationUsable(oauthAuthorization);

    return await withTransaction(async db => {
      let oauthToken = await this.issueOAuthToken({
        oauthAuthorization,
        withRefreshToken: true
      });

      await db.oAuthAuthorizationRequest.update({
        where: { oid: oauthAuthorizationRequest.oid },
        data: {
          status: 'consumed',
          consumedAt: new Date()
        }
      });

      return {
        oauthToken,
        oauthAuthorization,
        oauthInstallation: oauthAuthorization.oauthInstallation,
        oauthApplication: oauthAuthorization.oauthApplication
      };
    });
  }

  private async exchangeDeviceCodeToken(d: { clientId: string; deviceCode: string }) {
    let res = await this.checkDeviceCodeAuthorizationRequest(d);

    if (res.status == 'pending') {
      throw new ServiceError(
        badRequestError({
          message: 'Authorization is still pending',
          oauth: {
            error: 'authorization_pending',
            errorMessage: 'Authorization is still pending'
          }
        })
      );
    }

    if (res.status == 'consumed') {
      throw new ServiceError(
        unauthorizedError({
          message: 'Authorization request has been consumed',
          oauth: {
            error: 'invalid_grant',
            errorMessage: 'Authorization request has been consumed'
          }
        })
      );
    }

    if (res.status == 'denied') {
      throw new ServiceError(
        unauthorizedError({
          message: 'Authorization request has been denied',
          oauth: {
            error: 'access_denied',
            errorMessage: 'Authorization request has been denied'
          }
        })
      );
    }

    let oauthAuthorization = res.oauthAuthorizationRequest.oauthAuthorization;
    if (!oauthAuthorization) {
      throw new ServiceError(
        unauthorizedError({
          message: 'Invalid device code',
          oauth: {
            error: 'invalid_grant',
            errorMessage: 'Invalid device code'
          }
        })
      );
    }

    ensureAuthorizationUsable(oauthAuthorization);

    return await withTransaction(async db => {
      let oauthToken = await this.issueOAuthToken({
        oauthAuthorization,
        withRefreshToken: true
      });

      await db.oAuthAuthorizationRequest.update({
        where: { oid: res.oauthAuthorizationRequest.oid },
        data: {
          status: 'consumed',
          consumedAt: new Date()
        }
      });

      return {
        oauthToken,
        oauthAuthorization,
        oauthInstallation: oauthAuthorization.oauthInstallation,
        oauthApplication: oauthAuthorization.oauthApplication
      };
    });
  }

  private async exchangeClientCredentialsToken(d: {
    clientId: string;
    clientSecret: string;
    scopes?: string[];
    expiresIn?: number;
    context: Context;
  }) {
    if (
      d.expiresIn &&
      (d.expiresIn < ACCESS_TOKEN_MIN_TTL_SECONDS ||
        d.expiresIn > ACCESS_TOKEN_MAX_TTL_SECONDS)
    ) {
      throw new ServiceError(
        badRequestError({
          message: `expires_in must be between ${ACCESS_TOKEN_MIN_TTL_SECONDS} and ${ACCESS_TOKEN_MAX_TTL_SECONDS} seconds`,
          oauth: {
            error: 'invalid_request',
            errorMessage: `expires_in must be between ${ACCESS_TOKEN_MIN_TTL_SECONDS} and ${ACCESS_TOKEN_MAX_TTL_SECONDS} seconds`
          }
        })
      );
    }

    return await withTransaction(async () => {
      let oauthApplication = await this.getOAuthApplicationByClientId({
        clientId: d.clientId
      });
      let oauthClientSecret = await db.oAuthApplicationClientSecret.findFirst({
        where: {
          oauthApplicationOid: oauthApplication.oid,
          secret: d.clientSecret,
          deletedAt: null
        }
      });
      if (!oauthClientSecret) {
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

      let requestedScopes = validateOAuthScopes(d.scopes ?? oauthApplication.scopes);
      let scopes = ensureScopesAllowed({
        allowedScopes: oauthApplication.scopes,
        requestedScopes
      });

      let oauthAuthorization =
        await oauthAuthorizationInstallationService.getOrCreateServerSideAuthorization({
          oauthApplication,
          scopes,
          ip: d.context.ip
        });

      let oauthToken = await this.issueOAuthToken({
        oauthAuthorization,
        withRefreshToken: false,
        accessTokenLifetimeSeconds: d.expiresIn,
        context: d.context
      });

      return {
        oauthToken,
        oauthAuthorization,
        oauthInstallation: oauthAuthorization.oauthInstallation,
        oauthApplication: oauthAuthorization.oauthApplication
      };
    });
  }

  private async exchangeRefreshToken(d: { clientId: string; refreshToken: string }) {
    return await withTransaction(async db => {
      let oauthToken = await db.oAuthToken.findFirst({
        where: {
          refreshToken: d.refreshToken
        },
        include: tokenInclude
      });
      if (!oauthToken) {
        throw new ServiceError(
          unauthorizedError({
            message: 'Invalid refresh token',
            oauth: {
              error: 'invalid_grant',
              errorMessage: 'Invalid refresh token'
            }
          })
        );
      }

      if (oauthToken.oauthAuthorization.oauthApplication.clientId != d.clientId) {
        throw new ServiceError(
          unauthorizedError({
            message: 'Refresh token does not belong to this oauth client',
            oauth: {
              error: 'invalid_grant',
              errorMessage: 'Refresh token does not belong to this oauth client'
            }
          })
        );
      }

      ensureTokenRefreshable(oauthToken);
      let refreshedToken = await this.refreshOAuthToken({
        oauthToken,
        withRefreshToken: true
      });

      return {
        oauthToken: refreshedToken,
        oauthAuthorization: oauthToken.oauthAuthorization,
        oauthInstallation: oauthToken.oauthAuthorization.oauthInstallation,
        oauthApplication: oauthToken.oauthAuthorization.oauthApplication
      };
    });
  }

  async getOAuthApplicationByClientId(d: { clientId: string; clientSecret?: string }) {
    let oauthApplication = await this.getOAuthApplicationByClientIdSafe(d);
    if (!oauthApplication) {
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

    if (oauthApplication.status != 'active') {
      throw new ServiceError(
        unauthorizedError({
          message: 'OAuth application is archived',
          oauth: {
            error: 'invalid_client',
            errorMessage: 'OAuth application is archived'
          }
        })
      );
    }

    if (d.clientSecret && !oauthApplication.clientSecretValid) {
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

    return oauthApplication;
  }

  private async getOAuthApplicationByClientIdSafe(d: {
    clientId: string;
    clientSecret?: string;
  }) {
    let app = await db.oAuthApplication.findFirst({
      where: {
        clientId: d.clientId,
        status: 'active'
      },
      include: {
        organization: true,
        scopedInstallation: {
          include: installationInclude
        },
        serverSideMachineAccess: {
          include: machineAccessInclude
        },
        clientSecrets: d.clientSecret
          ? { where: { secret: d.clientSecret, deletedAt: null } }
          : false
      }
    });
    if (!app) return null;

    let clientSecretValid = d.clientSecret ? app.clientSecrets.length > 0 : null;

    return {
      ...app,
      clientSecretValid
    };
  }

  async getOAuthAuthorizationRequestByUrlToken(d: { urlToken: string }) {
    let oauthAuthorizationRequest = await db.oAuthAuthorizationRequest.findFirst({
      where: {
        urlToken: d.urlToken
      },
      include: authorizationRequestInclude
    });
    if (!oauthAuthorizationRequest) {
      throw new ServiceError(notFoundError('oauth_authorization_request', d.urlToken));
    }

    return oauthAuthorizationRequest;
  }

  private async resolveOrganizationMember(d: {
    oauthApplication: OAuthApplication & { organization: Organization | null };
    user: User;
    organizationId: string;
  }) {
    let organization: Organization;
    let member: OrganizationMember & { actor: OrganizationActor; user: User };

    if (d.oauthApplication.accessLevel == 'organization') {
      if (!d.oauthApplication.organization) {
        throw new ServiceError(
          badRequestError({
            message: 'Organization-scoped oauth application is missing its owning organization'
          })
        );
      }

      // Solve fixed org for user to ensure that the user has access
      let res = await organizationService.getOrganizationByIdForUser({
        organizationId: d.oauthApplication.organization.id,
        user: d.user
      });
      organization = res.organization;
      member = res.member;
    } else {
      let res = await organizationService.getOrganizationByIdForUser({
        organizationId: d.organizationId,
        user: d.user
      });
      organization = res.organization;
      member = res.member;
    }

    return {
      organization,
      member
    };
  }

  private async issueOAuthToken(d: {
    oauthAuthorization: OAuthAuthorizationWithRelations;
    withRefreshToken: boolean;
    accessTokenLifetimeSeconds?: number;
    refreshTokenLifetimeDays?: number;
    context?: Context;
  }) {
    return await withTransaction(async db => {
      await Fabric.fire('machine_access.oauth_token.created:before', {
        oauthApplication: d.oauthAuthorization.oauthApplication,
        oauthInstallation: d.oauthAuthorization.oauthInstallation,
        oauthAuthorization: d.oauthAuthorization,
        organization: d.oauthAuthorization.oauthInstallation.organization,
        appActor: d.oauthAuthorization.oauthInstallation.appActor,
        context: d.context
      });

      let tokenValues = createIssuedOAuthTokenValues(d);

      let data = {
        oauthInstallationOid: d.oauthAuthorization.oauthInstallationOid,
        ...tokenValues
      };

      let oauthToken = await db.oAuthToken.create({
        data: {
          id: await ID.generateId('oauthToken'),
          oauthAuthorizationOid: d.oauthAuthorization.oid,
          ...data
        },
        include: tokenInclude
      });

      addAfterTransactionHook(() =>
        Fabric.fire('machine_access.oauth_token.created:after', {
          oauthApplication: oauthToken.oauthAuthorization.oauthApplication,
          oauthInstallation: oauthToken.oauthAuthorization.oauthInstallation,
          oauthAuthorization: oauthToken.oauthAuthorization,
          oauthToken,
          organization: oauthToken.oauthAuthorization.oauthInstallation.organization,
          appActor: oauthToken.oauthAuthorization.oauthInstallation.appActor,
          context: d.context
        })
      );

      return oauthToken;
    });
  }

  private async refreshOAuthToken(d: {
    oauthToken: OAuthTokenWithRelations;
    withRefreshToken: boolean;
    accessTokenLifetimeSeconds?: number;
    refreshTokenLifetimeDays?: number;
    context?: Context;
  }) {
    return await withTransaction(async db => {
      await Fabric.fire('machine_access.oauth_token.refreshed:before', {
        oauthApplication: d.oauthToken.oauthAuthorization.oauthApplication,
        oauthInstallation: d.oauthToken.oauthAuthorization.oauthInstallation,
        oauthAuthorization: d.oauthToken.oauthAuthorization,
        oauthToken: d.oauthToken,
        organization: d.oauthToken.oauthAuthorization.oauthInstallation.organization,
        appActor: d.oauthToken.oauthAuthorization.oauthInstallation.appActor,
        context: d.context
      });

      let tokenValues = createIssuedOAuthTokenValues(d);

      let oauthToken = await db.oAuthToken.update({
        where: {
          oid: d.oauthToken.oid
        },
        data: {
          oauthInstallationOid: d.oauthToken.oauthAuthorization.oauthInstallationOid,
          ...tokenValues
        },
        include: tokenInclude
      });

      addAfterTransactionHook(() =>
        Fabric.fire('machine_access.oauth_token.refreshed:after', {
          oauthApplication: oauthToken.oauthAuthorization.oauthApplication,
          oauthInstallation: oauthToken.oauthAuthorization.oauthInstallation,
          oauthAuthorization: oauthToken.oauthAuthorization,
          oauthToken,
          organization: oauthToken.oauthAuthorization.oauthInstallation.organization,
          appActor: oauthToken.oauthAuthorization.oauthInstallation.appActor,
          context: d.context
        })
      );

      return oauthToken;
    });
  }

  async createOAuthAuthorizationRequest(d: {
    context: Context;
    input:
      | {
          type: 'interactive';
          clientId: string;
          scopes: string[];
          redirectUri: string;
          state?: string;
          codeChallengeMethod?: OAuthAuthorizationRequestChallengeMethod;
          codeChallenge?: string;
        }
      | {
          type: 'device_code';
          clientId: string;
          clientIp: string;
          scopes: string[];
          allowCliAuth?: boolean;
        };
  }) {
    return await withTransaction(async db => {
      let oauthApplication = await this.getOAuthApplicationByClientId({
        clientId: d.input.clientId
      });

      this.assertApplicationSupportsAuthorizationRequest({
        oauthApplication,
        requestType: d.input.type,
        allowCliAuth: d.input.type == 'device_code' ? d.input.allowCliAuth : false
      });

      let requestedScopes = validateOAuthScopes(d.input.scopes);
      let scopes = ensureScopesAllowed({
        allowedScopes: oauthApplication.scopes,
        requestedScopes
      });

      if (d.input.type == 'interactive') {
        validateRedirectUri({
          redirectUri: d.input.redirectUri,
          allowedRedirectUris: oauthApplication.redirectUris
        });
      }

      return await db.oAuthAuthorizationRequest.create({
        data: {
          id: await ID.generateId('oauthAuthorizationRequest'),
          type: d.input.type,
          status: 'pending',
          oauthApplicationOid: oauthApplication.oid,

          scopes,

          urlToken: generateCustomId('mtout_', 50),
          code: generateCustomId('metorial_oauth_token', 50),

          // Device code flow
          deviceCode:
            d.input.type == 'device_code' ? generateCustomId('mt_oauth_device', 50) : null,
          userCode:
            d.input.type == 'device_code' ? `${generateCode(4)}-${generateCode(4)}` : null,
          clientIp: d.input.type == 'device_code' ? d.input.clientIp : d.context.ip,

          // Interactive flow
          state: d.input.type == 'interactive' ? d.input.state : null,
          redirectUri: d.input.type == 'interactive' ? d.input.redirectUri : null,
          codeChallengeMethod:
            d.input.type == 'interactive' ? (d.input.codeChallengeMethod ?? 'none') : 'none',
          codeChallenge: d.input.type == 'interactive' ? d.input.codeChallenge : null,

          expiresAt:
            d.input.type == 'interactive'
              ? addMinutes(new Date(), INTERACTIVE_REQUEST_TTL_MINUTES)
              : addMinutes(new Date(), DEVICE_REQUEST_TTL_MINUTES)
        },
        include: authorizationRequestInclude
      });
    });
  }

  async createCliAuthAuthorizationRequest(d: { context: Context }) {
    let cliAuthApplication = await oauthApplicationService.getCliAuthOAuthApplication();

    if (!cliAuthApplication) {
      throw new ServiceError(
        badRequestError({
          message: 'CLI auth is not enabled',
          oauth: {
            error: 'cli_auth_disabled',
            errorMessage: 'CLI auth is not enabled'
          }
        })
      );
    }

    return await this.createOAuthAuthorizationRequest({
      context: d.context,
      input: {
        type: 'device_code',
        clientId: cliAuthApplication.clientId,
        clientIp: d.context.ip,
        scopes: cliAuthApplication.scopes,
        allowCliAuth: true
      }
    });
  }

  async exchangeCliAuthToken(d: { token: string }) {
    let cliAuthApplication = await oauthApplicationService.getCliAuthOAuthApplication();

    if (!cliAuthApplication) {
      throw new ServiceError(
        badRequestError({
          message: 'CLI auth is not enabled',
          oauth: {
            error: 'cli_auth_disabled',
            errorMessage: 'CLI auth is not enabled'
          }
        })
      );
    }

    return await this.exchangeDeviceCodeToken({
      clientId: cliAuthApplication.clientId,
      deviceCode: d.token
    });
  }

  async acceptOAuthAuthorizationRequest(d: {
    oauthAuthorizationRequest: OAuthAuthorizationRequest & {
      oauthApplication: OAuthApplication & {
        organization: Organization | null;
        scopedInstallation:
          | (OAuthInstallation & {
              serverSideMachineAccess: MachineAccess | null;
            })
          | null;
      };
    };
    user: User;
    organizationId: string;
    context: Context;
  }) {
    ensureAuthorizationRequestPending(d.oauthAuthorizationRequest);

    let { organization, member } = await this.resolveOrganizationMember({
      oauthApplication: d.oauthAuthorizationRequest.oauthApplication,
      user: d.user,
      organizationId: d.organizationId
    });

    return await withTransaction(async db => {
      let oauthInstallation =
        await oauthAuthorizationInstallationService.getOrCreateInstallation({
          oauthApplication: d.oauthAuthorizationRequest.oauthApplication,
          organization
        });

      let oauthAuthorization =
        await oauthAuthorizationInstallationService.getOrCreateUserAuthorization({
          oauthApplication: d.oauthAuthorizationRequest.oauthApplication,
          oauthInstallation,
          organization,
          member,
          user: d.user,
          scopes: d.oauthAuthorizationRequest.scopes,
          requestingIp: d.oauthAuthorizationRequest.clientIp,
          acceptingIp: d.context.ip,
          context: d.context
        });

      if (
        d.oauthAuthorizationRequest.oauthApplication.type == 'cli_auth' &&
        d.oauthAuthorizationRequest.clientIp
      ) {
        await cliDeviceService.upsertCliDevice({
          ip: d.oauthAuthorizationRequest.clientIp,
          organization,
          user: d.user,
          oauthAuthorization
        });
      }

      let oauthAuthorizationRequest = await db.oAuthAuthorizationRequest.update({
        where: { oid: d.oauthAuthorizationRequest.oid },
        data: {
          status: 'accepted',
          oauthAuthorizationOid: oauthAuthorization.oid,
          acceptedAt: new Date(),
          organizationOid: organization.oid,
          userOid: d.user.oid,
          expiresAt:
            d.oauthAuthorizationRequest.type == 'interactive'
              ? addSeconds(new Date(), 30)
              : addSeconds(new Date(), 90)
        },
        include: authorizationRequestInclude
      });

      await Fabric.fire('machine_access.oauth_authorization_request.accepted:before', {
        oauthApplication: oauthAuthorizationRequest.oauthApplication,
        oauthAuthorizationRequest,
        organization,
        member,
        performedBy: member.actor,
        context: d.context
      });

      addAfterTransactionHook(() =>
        Fabric.fire('machine_access.oauth_authorization_request.accepted:after', {
          oauthApplication: oauthAuthorizationRequest.oauthApplication,
          oauthAuthorizationRequest,
          organization,
          member,
          performedBy: member.actor,
          context: d.context
        })
      );

      return {
        oauthAuthorizationRequest,
        oauthAuthorization,
        oauthInstallation
      };
    });
  }

  async rejectOAuthAuthorizationRequest(d: {
    user: User;
    oauthAuthorizationRequest: OAuthAuthorizationRequest & {
      oauthApplication: OAuthApplication & { organization: Organization | null };
    };
    organizationId?: string;
    context?: Context;
  }) {
    ensureAuthorizationRequestPending(d.oauthAuthorizationRequest);

    let organizationMember = await (async () => {
      if (!d.organizationId) return null;

      try {
        return await this.resolveOrganizationMember({
          oauthApplication: d.oauthAuthorizationRequest.oauthApplication,
          user: d.user,
          organizationId: d.organizationId
        });
      } catch {
        return null;
      }
    })();

    return await withTransaction(async db => {
      if (organizationMember) {
        await Fabric.fire('machine_access.oauth_authorization_request.denied:before', {
          oauthApplication: d.oauthAuthorizationRequest.oauthApplication,
          oauthAuthorizationRequest: d.oauthAuthorizationRequest,
          organization: organizationMember.organization,
          member: organizationMember.member,
          performedBy: organizationMember.member.actor,
          context: d.context
        });
      }

      let oauthAuthorizationRequest = await db.oAuthAuthorizationRequest.update({
        where: { oid: d.oauthAuthorizationRequest.oid },
        data: {
          status: 'denied',
          deniedAt: new Date(),
          userOid: d.user.oid
        },
        include: authorizationRequestInclude
      });

      if (organizationMember) {
        addAfterTransactionHook(() =>
          Fabric.fire('machine_access.oauth_authorization_request.denied:after', {
            oauthApplication: oauthAuthorizationRequest.oauthApplication,
            oauthAuthorizationRequest,
            organization: organizationMember.organization,
            member: organizationMember.member,
            performedBy: organizationMember.member.actor,
            context: d.context
          })
        );
      }

      return oauthAuthorizationRequest;
    });
  }

  async revokeOAuthAuthorization(d: {
    oauthAuthorization: OAuthAuthorization;
    performedBy: OrganizationActor;
    context?: Context;
  }) {
    return await withTransaction(async db => {
      let existingAuthorization = await db.oAuthAuthorization.findFirstOrThrow({
        where: {
          oid: d.oauthAuthorization.oid
        },
        include: authorizationInclude
      });

      await Fabric.fire('machine_access.oauth_authorization.revoked:before', {
        oauthApplication: existingAuthorization.oauthApplication,
        oauthInstallation: existingAuthorization.oauthInstallation,
        oauthAuthorization: existingAuthorization,
        organization: existingAuthorization.oauthInstallation.organization,
        appActor: existingAuthorization.oauthInstallation.appActor,
        performedBy: d.performedBy,
        context: d.context
      });

      let oauthAuthorization = await db.oAuthAuthorization.update({
        where: {
          oid: d.oauthAuthorization.oid
        },
        data: {
          status: 'revoked',
          revokedAt: new Date()
        },
        include: authorizationInclude
      });

      addAfterTransactionHook(() =>
        Fabric.fire('machine_access.oauth_authorization.revoked:after', {
          oauthApplication: oauthAuthorization.oauthApplication,
          oauthInstallation: oauthAuthorization.oauthInstallation,
          oauthAuthorization,
          organization: oauthAuthorization.oauthInstallation.organization,
          appActor: oauthAuthorization.oauthInstallation.appActor,
          performedBy: d.performedBy,
          context: d.context
        })
      );

      return oauthAuthorization;
    });
  }

  async getOAuthAuthorizationById(d: {
    organization: Organization;
    oauthAuthorizationId: string;
  }) {
    let oauthAuthorization = await db.oAuthAuthorization.findFirst({
      where: {
        id: d.oauthAuthorizationId,
        organizationOid: d.organization.oid
      },
      include: authorizationInclude
    });

    if (!oauthAuthorization) {
      throw new ServiceError(notFoundError('oauth_authorization', d.oauthAuthorizationId));
    }

    return oauthAuthorization;
  }

  async listOAuthAuthorizations(d: {
    organization: Organization;
    oauthInstallationIds?: string[];
    oauthApplicationIds?: string[];
    statuses?: OAuthAuthorizationStatus[];
  }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.oAuthAuthorization.findMany({
            ...opts,
            where: {
              organizationOid: d.organization.oid,
              status: d.statuses ? { in: d.statuses } : undefined,
              oauthInstallation: d.oauthInstallationIds
                ? {
                    id: {
                      in: d.oauthInstallationIds
                    }
                  }
                : undefined,
              oauthApplication: {
                id: d.oauthApplicationIds
                  ? {
                      in: d.oauthApplicationIds
                    }
                  : undefined,
                type: {
                  not: 'server_side'
                }
              }
            },
            include: authorizationInclude
          })
      )
    );
  }
}

export let oauthAuthorizationService = Service.create(
  'oauthAuthorizationService',
  () => new OAuthAuthorizationService()
).build();

export let authorizationInclude = {
  oauthApplication: {
    include: {
      organization: true
    }
  },
  oauthInstallation: {
    include: installationInclude
  },
  organizationMember: true,
  machineAccess: {
    include: machineAccessInclude
  },
  user: true
} as const;

export type OAuthAuthorizationWithRelations = Prisma.OAuthAuthorizationGetPayload<{
  include: typeof authorizationInclude;
}>;

type OAuthTokenWithRelations = Prisma.OAuthTokenGetPayload<{
  include: typeof tokenInclude;
}>;

let oauthApplicationInclude = {
  organization: true,
  scopedInstallation: {
    include: installationInclude
  },
  serverSideMachineAccess: {
    include: machineAccessInclude
  }
} as const;

let authorizationRequestInclude = {
  oauthApplication: {
    include: oauthApplicationInclude
  },
  oauthAuthorization: {
    include: authorizationInclude
  }
} as const;

let tokenInclude = {
  oauthAuthorization: { include: authorizationInclude }
} as const;
