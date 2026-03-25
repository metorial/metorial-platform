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
  OAuthApplication,
  OAuthApplicationType,
  OAuthAuthorization,
  OAuthAuthorizationFlowChallengeMethod,
  OAuthAuthorizationStatus,
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
import {
  GlobalOAuthAuthorizationRequestWithRelations,
  oauthGlobalRepository
} from '@metorial/multi-region';
import { addMinutes, addSeconds, differenceInSeconds } from 'date-fns';
import {
  ensureAuthorizationRequestPending,
  ensureAuthorizationUsable,
  ensureScopesAllowed,
  ensureTokenRefreshable
} from '../lib/oauthAuthorizationGuards';
import { createCodeChallenge } from '../lib/oauthAuthorizationPkce';
import {
  getServiceAccountEffectiveScopes,
  getUserEffectiveScopes
} from '../lib/oauthAuthorizationScopes';
import {
  ACCESS_TOKEN_MAX_TTL_SECONDS,
  ACCESS_TOKEN_MIN_TTL_SECONDS,
  createIssuedOAuthTokenValues,
  DEVICE_REQUEST_TTL_MINUTES,
  INTERACTIVE_REQUEST_TTL_MINUTES
} from '../lib/oauthAuthorizationTokens';
import { validateOAuthScopes } from '../lib/oauthScopeValidation';
import { urlsMatch, validateRedirectUri } from '../lib/oauthUrls';
import { splitOAuthAndOidcScopes } from '../lib/oidc';
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

  private assertDeploymentResponsibleForApplication(oauthApplication: OAuthApplication) {
    if (
      oauthApplication.accessLevel == 'organization' &&
      oauthApplication.isImportedFromOtherInstance
    ) {
      throw new ServiceError(
        forbiddenError({
          message: 'This deployment is not responsible for this oauth application'
        })
      );
    }
  }

  private async getLocalOAuthApplicationById(d: { oauthApplicationId: string }) {
    let oauthApplication = await db.oAuthApplication.findFirst({
      where: {
        id: d.oauthApplicationId
      },
      include: oauthApplicationInclude
    });

    if (!oauthApplication) {
      throw new ServiceError(
        forbiddenError({
          message: 'This deployment is not responsible for this oauth application'
        })
      );
    }

    this.assertDeploymentResponsibleForApplication(oauthApplication);

    return oauthApplication;
  }

  private async getOAuthAuthorizationFlowById(d: { id: string }) {
    return await db.oAuthAuthorizationFlow.findFirst({
      where: { id: d.id },
      include: authorizationFlowInclude
    });
  }

  private async hydrateOAuthAuthorizationRequest(
    globalRequest: GlobalOAuthAuthorizationRequestWithRelations
  ): Promise<OAuthAuthorizationRequestWithRelations> {
    let [oauthApplication, oauthAuthorizationFlow] = await Promise.all([
      this.getLocalOAuthApplicationById({
        oauthApplicationId: globalRequest.oauthApplicationId
      }),
      this.getOAuthAuthorizationFlowById({ id: globalRequest.id })
    ]);

    return {
      ...globalRequest,
      status:
        oauthAuthorizationFlow?.status == 'consumed'
          ? 'consumed'
          : (globalRequest.status as Exclude<OAuthAuthorizationRequestStatus, 'consumed'>),
      oauthApplication,
      oauthAuthorizationFlow
    };
  }

  async checkDeviceCodeAuthorizationRequest(d: { clientId: string; deviceCode: string }) {
    let globalRequest = await oauthGlobalRepository.getOAuthAuthorizationRequestByDeviceCode({
      deviceCode: d.deviceCode
    });

    if (
      !globalRequest ||
      globalRequest.oauthApplication.clientId != d.clientId ||
      globalRequest.expiresAt < new Date()
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

    if (globalRequest.type != 'device_code') {
      throw new ServiceError(
        badRequestError({
          message: 'Authorization request is not a device-code flow'
        })
      );
    }

    if (
      globalRequest.lastPollAt &&
      differenceInSeconds(new Date(), globalRequest.lastPollAt) < 4
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

    globalRequest = await oauthGlobalRepository.touchOAuthAuthorizationRequestPoll({
      id: globalRequest.id,
      at: new Date()
    });

    let oauthAuthorizationRequest = await this.hydrateOAuthAuthorizationRequest(globalRequest);

    if (oauthAuthorizationRequest.status == 'denied') {
      return {
        status: 'denied' as const,
        oauthAuthorizationRequest
      };
    }

    if (
      oauthAuthorizationRequest.status == 'accepted' &&
      oauthAuthorizationRequest.oauthAuthorizationFlow
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
  }

  async exchangeOAuthToken(d: {
    context: Context;
    input:
      | {
          grantType: 'authorization_code';
          clientId: string;
          code: string;
          redirectUri: string;
          clientSecret?: string;
          codeVerifier?: string;
        }
      | {
          grantType: 'urn:ietf:params:oauth:grant-type:device_code' | 'device_code';
          clientId: string;
          clientSecret?: string;
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
    clientSecret?: string;
    codeVerifier?: string;
  }) {
    let globalRequest = await oauthGlobalRepository.getOAuthAuthorizationRequestByCode({
      code: d.code
    });
    let oauthAuthorizationRequest = globalRequest
      ? await this.hydrateOAuthAuthorizationRequest(globalRequest)
      : null;

    if (
      !oauthAuthorizationRequest ||
      oauthAuthorizationRequest.status != 'accepted' ||
      oauthAuthorizationRequest.oauthApplication.clientId != d.clientId ||
      !oauthAuthorizationRequest.oauthAuthorizationFlow
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

    let oauthAuthorizationFlow = oauthAuthorizationRequest.oauthAuthorizationFlow;
    if (oauthAuthorizationFlow.type != 'interactive') {
      throw new ServiceError(
        badRequestError({
          message: 'Authorization request cannot be used for this grant type'
        })
      );
    }

    if (!urlsMatch(oauthAuthorizationFlow.redirectUri!, d.redirectUri)) {
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

    if (oauthAuthorizationFlow.codeChallengeMethod == 's256') {
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
      if (codeChallenge != oauthAuthorizationFlow.codeChallenge) {
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

    if (oauthAuthorizationFlow.codeChallengeMethod == 'none' && d.codeVerifier) {
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

    let oauthAuthorization = oauthAuthorizationFlow.oauthAuthorization;
    ensureAuthorizationUsable(oauthAuthorization);

    if (
      !d.clientSecret &&
      !oauthAuthorizationRequest.oauthApplication.allowClientSecretlessTokenExchange
    ) {
      throw new ServiceError(
        unauthorizedError({
          message: 'A client secret is required for this oauth client',
          oauth: {
            error: 'invalid_client',
            errorMessage: 'A client secret is required for this oauth client'
          }
        })
      );
    }

    return await withTransaction(async db => {
      let oauthToken = await this.issueOAuthToken({
        oauthAuthorization,
        withRefreshToken: !!d.clientSecret
      });

      await db.oAuthAuthorizationFlow.update({
        where: { oid: oauthAuthorizationFlow.oid },
        data: {
          status: 'consumed',
          consumedAt: new Date()
        }
      });

      return {
        oauthToken,
        oauthAuthorization,
        oauthInstallation: oauthAuthorization.oauthInstallation,
        oauthApplication: oauthAuthorization.oauthApplication,
        oauthAuthorizationRequest
      };
    });
  }

  private async exchangeDeviceCodeToken(d: {
    clientId: string;
    clientSecret?: string;
    deviceCode: string;
  }) {
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

    let oauthAuthorizationFlow = res.oauthAuthorizationRequest.oauthAuthorizationFlow;
    let oauthAuthorization = oauthAuthorizationFlow?.oauthAuthorization;
    if (!oauthAuthorization || !oauthAuthorizationFlow) {
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
    if (!oauthAuthorizationFlow) {
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

    if (
      !d.clientSecret &&
      !res.oauthAuthorizationRequest.oauthApplication.allowClientSecretlessTokenExchange
    ) {
      throw new ServiceError(
        unauthorizedError({
          message: 'A client secret is required for this oauth client',
          oauth: {
            error: 'invalid_client',
            errorMessage: 'A client secret is required for this oauth client'
          }
        })
      );
    }

    return await withTransaction(async db => {
      let oauthToken = await this.issueOAuthToken({
        oauthAuthorization,
        withRefreshToken: !!d.clientSecret
      });

      await db.oAuthAuthorizationFlow.update({
        where: { oid: oauthAuthorizationFlow.oid },
        data: {
          status: 'consumed',
          consumedAt: new Date()
        }
      });

      return {
        oauthToken,
        oauthAuthorization,
        oauthInstallation: oauthAuthorization.oauthInstallation,
        oauthApplication: oauthAuthorization.oauthApplication,
        oauthAuthorizationRequest: res.oauthAuthorizationRequest
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
      let requestedApplicationScopes = ensureScopesAllowed({
        allowedScopes: oauthApplication.scopes,
        requestedScopes
      });

      let serviceAccount = await db.serviceAccount.findFirst({
        where: {
          oauthApplicationOid: oauthApplication.oid
        }
      });
      let scopes = serviceAccount
        ? await getServiceAccountEffectiveScopes({
            organization: oauthApplication.organization!,
            serviceAccount,
            oauthApplication,
            requestedScopes: requestedApplicationScopes
          })
        : requestedApplicationScopes;

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

    this.assertDeploymentResponsibleForApplication(oauthApplication);

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
    let globalRequest = await oauthGlobalRepository.getOAuthAuthorizationRequestByUrlToken({
      urlToken: d.urlToken
    });
    if (!globalRequest) {
      throw new ServiceError(notFoundError('oauth_authorization_request', d.urlToken));
    }

    return await this.hydrateOAuthAuthorizationRequest(globalRequest);
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
          nonce?: string;
          codeChallengeMethod?: OAuthAuthorizationFlowChallengeMethod;
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
    let oauthApplication = await this.getOAuthApplicationByClientId({
      clientId: d.input.clientId
    });

    this.assertApplicationSupportsAuthorizationRequest({
      oauthApplication,
      requestType: d.input.type,
      allowCliAuth: d.input.type == 'device_code' ? d.input.allowCliAuth : false
    });

    let requestedScopes = splitOAuthAndOidcScopes(d.input.scopes);
    let scopes = ensureScopesAllowed({
      allowedScopes: oauthApplication.scopes,
      requestedScopes: requestedScopes.accessScopes
    });

    if (d.input.type == 'interactive') {
      validateRedirectUri({
        redirectUri: d.input.redirectUri,
        allowedRedirectUris: oauthApplication.redirectUris
      });
    }

    let globalRequest = await oauthGlobalRepository.createOAuthAuthorizationRequest({
      id: await ID.generateId('oauthAuthorizationRequest'),
      oauthApplicationId: oauthApplication.id,
      type: d.input.type,
      scopes,
      oidcScopes: requestedScopes.oidcScopes,
      urlToken: generateCustomId('mtout_', 50),
      code: generateCustomId('metorial_oauth_token', 50),
      deviceCode:
        d.input.type == 'device_code' ? generateCustomId('mt_oauth_device', 50) : null,
      userCode: d.input.type == 'device_code' ? `${generateCode(4)}-${generateCode(4)}` : null,
      clientIp: d.input.type == 'device_code' ? d.input.clientIp : d.context.ip,
      state: d.input.type == 'interactive' ? d.input.state : null,
      redirectUri: d.input.type == 'interactive' ? d.input.redirectUri : null,
      nonce: d.input.type == 'interactive' ? d.input.nonce : null,
      codeChallengeMethod:
        d.input.type == 'interactive' ? (d.input.codeChallengeMethod ?? 'none') : 'none',
      codeChallenge: d.input.type == 'interactive' ? d.input.codeChallenge : null,
      expiresAt:
        d.input.type == 'interactive'
          ? addMinutes(new Date(), INTERACTIVE_REQUEST_TTL_MINUTES)
          : addMinutes(new Date(), DEVICE_REQUEST_TTL_MINUTES)
    });

    return await this.hydrateOAuthAuthorizationRequest(globalRequest);
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
    oauthAuthorizationRequest: OAuthAuthorizationRequestWithRelations;
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
    let scopes = await getUserEffectiveScopes({
      organization,
      member,
      oauthApplication: d.oauthAuthorizationRequest.oauthApplication,
      requestedScopes: d.oauthAuthorizationRequest.scopes
    });
    let missingScopes = d.oauthAuthorizationRequest.scopes.filter(
      scope => !scopes.includes(scope)
    );
    if (missingScopes.length > 0) {
      throw new ServiceError(
        forbiddenError({
          message:
            'You cannot accept this app because it requires permissions that you do not have',
          oauth: {
            error: 'access_denied',
            errorMessage:
              'You cannot accept this app because it requires permissions that you do not have'
          }
        })
      );
    }

    let claimedRequest = await oauthGlobalRepository.claimOAuthAuthorizationRequest({
      id: d.oauthAuthorizationRequest.id
    });
    if (!claimedRequest) {
      throw new ServiceError(
        badRequestError({
          message: 'OAuth authorization request can no longer be accepted'
        })
      );
    }

    let acceptedAt = new Date();
    let expiresAt =
      d.oauthAuthorizationRequest.type == 'interactive'
        ? addSeconds(acceptedAt, 30)
        : addSeconds(acceptedAt, 90);

    let oauthAuthorizationFlow = await withTransaction(async db => {
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
          scopes,
          oidcScopes: d.oauthAuthorizationRequest.oidcScopes,
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

      return await db.oAuthAuthorizationFlow.upsert({
        where: {
          id: d.oauthAuthorizationRequest.id
        },
        create: {
          id: d.oauthAuthorizationRequest.id,
          type: d.oauthAuthorizationRequest.type,
          status: 'accepted',
          scopes,
          oidcScopes: d.oauthAuthorizationRequest.oidcScopes,
          clientIp: d.oauthAuthorizationRequest.clientIp,
          redirectUri: d.oauthAuthorizationRequest.redirectUri,
          nonce: d.oauthAuthorizationRequest.nonce,
          userOid: d.user.oid,
          organizationOid: organization.oid,
          codeChallengeMethod: d.oauthAuthorizationRequest.codeChallengeMethod,
          codeChallenge: d.oauthAuthorizationRequest.codeChallenge,
          oauthApplicationOid: d.oauthAuthorizationRequest.oauthApplication.oid,
          oauthAuthorizationOid: oauthAuthorization.oid,
          acceptedAt,
          expiresAt
        },
        update: {
          status: 'accepted',
          scopes,
          oidcScopes: d.oauthAuthorizationRequest.oidcScopes,
          clientIp: d.oauthAuthorizationRequest.clientIp,
          redirectUri: d.oauthAuthorizationRequest.redirectUri,
          nonce: d.oauthAuthorizationRequest.nonce,
          userOid: d.user.oid,
          organizationOid: organization.oid,
          codeChallengeMethod: d.oauthAuthorizationRequest.codeChallengeMethod,
          codeChallenge: d.oauthAuthorizationRequest.codeChallenge,
          oauthApplicationOid: d.oauthAuthorizationRequest.oauthApplication.oid,
          oauthAuthorizationOid: oauthAuthorization.oid,
          acceptedAt,
          expiresAt,
          consumedAt: null
        },
        include: authorizationFlowInclude
      });
    });

    let acceptedRequest = await oauthGlobalRepository.acceptOAuthAuthorizationRequest({
      id: d.oauthAuthorizationRequest.id,
      userId: d.user.id,
      expiresAt
    });
    if (!acceptedRequest) {
      throw new ServiceError(
        badRequestError({
          message: 'OAuth authorization request can no longer be accepted'
        })
      );
    }

    let oauthAuthorizationRequest = {
      ...acceptedRequest,
      status: acceptedRequest.status as OAuthAuthorizationRequestStatus,
      oauthApplication: d.oauthAuthorizationRequest.oauthApplication,
      oauthAuthorizationFlow
    };

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
      oauthAuthorization: oauthAuthorizationFlow.oauthAuthorization,
      oauthInstallation: oauthAuthorizationFlow.oauthAuthorization.oauthInstallation
    };
  }

  async rejectOAuthAuthorizationRequest(d: {
    user: User;
    oauthAuthorizationRequest: OAuthAuthorizationRequestWithRelations;
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

    let rejectedRequest = await oauthGlobalRepository.rejectOAuthAuthorizationRequest({
      id: d.oauthAuthorizationRequest.id,
      userId: d.user.id
    });
    if (!rejectedRequest) {
      throw new ServiceError(
        badRequestError({
          message: 'OAuth authorization request can no longer be rejected'
        })
      );
    }

    let oauthAuthorizationRequest = {
      ...rejectedRequest,
      status: rejectedRequest.status as OAuthAuthorizationRequestStatus,
      oauthApplication: d.oauthAuthorizationRequest.oauthApplication,
      oauthAuthorizationFlow: null
    };

    if (organizationMember) {
      addAfterTransactionHook(() =>
        Fabric.fire('machine_access.oauth_authorization_request.denied:after', {
          oauthApplication: oauthAuthorizationRequest.oauthApplication,
          oauthAuthorizationRequest: oauthAuthorizationRequest,
          organization: organizationMember.organization,
          member: organizationMember.member,
          performedBy: organizationMember.member.actor,
          context: d.context
        })
      );
    }

    return oauthAuthorizationRequest;
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

type OAuthAuthorizationRequestStatus = 'pending' | 'accepted' | 'denied' | 'consumed';

let oauthApplicationInclude = {
  organization: true,
  scopedInstallation: {
    include: installationInclude
  },
  serverSideMachineAccess: {
    include: machineAccessInclude
  }
} as const;

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

let authorizationFlowInclude = {
  oauthApplication: {
    include: oauthApplicationInclude
  },
  oauthAuthorization: {
    include: authorizationInclude
  },
  organization: true,
  user: true
} as const;

let tokenInclude = {
  oauthAuthorization: { include: authorizationInclude }
} as const;

type OAuthApplicationWithRelations = Prisma.OAuthApplicationGetPayload<{
  include: typeof oauthApplicationInclude;
}>;

export type OAuthAuthorizationWithRelations = Prisma.OAuthAuthorizationGetPayload<{
  include: typeof authorizationInclude;
}>;

type OAuthAuthorizationFlowWithRelations = Prisma.OAuthAuthorizationFlowGetPayload<{
  include: typeof authorizationFlowInclude;
}>;

type OAuthTokenWithRelations = Prisma.OAuthTokenGetPayload<{
  include: typeof tokenInclude;
}>;

export type OAuthAuthorizationRequestWithRelations = Omit<
  GlobalOAuthAuthorizationRequestWithRelations,
  'oauthApplication' | 'status'
> & {
  status: OAuthAuthorizationRequestStatus;
  oauthApplication: OAuthApplicationWithRelations;
  oauthAuthorizationFlow: OAuthAuthorizationFlowWithRelations | null;
};
