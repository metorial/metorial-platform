import { Context } from '@metorial/context';
import {
  db,
  ID,
  Instance,
  ProviderOAuthConfig,
  ProviderOAuthConnection,
  ProviderOAuthConnectionProfile
} from '@metorial/db';
import { isServiceError, ServiceError } from '@metorial/error';
import { badRequestError } from '@metorial/error/src/defaultErrors';
import { Fabric } from '@metorial/fabric';
import { profileService } from '@metorial/module-community';
import { lambdaServerOAuthService } from '@metorial/module-custom-server';
import { getSentry } from '@metorial/sentry';
import { Service } from '@metorial/service';
import { subMinutes } from 'date-fns';
import { callbackUrl } from '../const';
import { formSchema } from '../lib/formSchema';
import { oauthErrorDescriptions } from '../lib/oauthErrors';
import { OAuthUtils } from '../lib/oauthUtils';
import { useAuthToken } from '../lib/useToken';
import {
  OAuthConfiguration,
  TokenResponse,
  tokenResponseValidator,
  UserProfile
} from '../types';

let Sentry = getSentry();

class OauthAuthorizationServiceImpl {
  async startAuthorization(d: {
    context: Context;
    connection: ProviderOAuthConnection & {
      config: ProviderOAuthConfig;
    };
    redirectUri: string;
    fieldValues: Record<string, string> | null;
  }) {
    if (d.connection.status != 'active') {
      throw new ServiceError(
        badRequestError({
          message: 'Connection is not active and cannot be used for authentication'
        })
      );
    }

    if (!d.connection.clientId) {
      throw new ServiceError(
        badRequestError({
          message: 'Connection is not fully set up yet and cannot be used for authentication'
        })
      );
    }

    console.log('Starting authorization for connection:', d.connection);

    if (
      d.connection.config.type == 'managed_server_http' ||
      d.connection.config.type == 'managed_server_lambda'
    ) {
      if (!d.connection.config.lambdaServerInstanceForManagedServerOid) {
        throw new Error(
          'WTF - Remote OAuth configuration is missing lambdaServerInstanceForManagedServerOid'
        );
      }

      let lambdaInstance = await db.lambdaServerInstance.findUniqueOrThrow({
        where: { oid: d.connection.config.lambdaServerInstanceForManagedServerOid },
        include: { instance: { include: { organization: true } } }
      });

      let form = d.connection.config.hasRemoteOauthForm
        ? undefined
        : await (async () => {
            if (!d.connection.config.hasRemoteOauthForm) return undefined;

            let form = await lambdaServerOAuthService.getOAuthForm({
              lambda: lambdaInstance
            });

            let valRes = formSchema.validate(form);
            if (!valRes.success) {
              throw new ServiceError(
                badRequestError({
                  message: 'Remote server returned an invalid authorization form',
                  details: valRes.errors
                })
              );
            }

            return valRes.value;
          })();

      if (form && !d.fieldValues) {
        let profile = await profileService.ensureProfile({
          for: {
            type: 'organization',
            organization: lambdaInstance.instance.organization
          }
        });

        if (form.fields.length) {
          return {
            type: 'form' as const,
            form,
            profile
          };
        }
      }

      if (form && d.fieldValues) {
        for (let field of form.fields) {
          if (field.isRequired && !d.fieldValues[field.key]) {
            throw new ServiceError(
              badRequestError({
                message: `Missing required field: ${field.label}`
              })
            );
          }

          if (field.type === 'select') {
            let allowedFields = field.options.map(o => o.value);
            if (!allowedFields.includes(d.fieldValues[field.key])) {
              throw new ServiceError(
                badRequestError({
                  message: `Invalid value for field: ${field.label}`
                })
              );
            }
          }
        }
      }

      let authAttempt = await db.providerOAuthConnectionAuthAttempt.create({
        data: {
          id: await ID.generateId('oauthConnectionAuthAttempt'),

          stateIdentifier: await ID.generateId('oauthConnectionAuthAttempt_State'),

          additionalValues: d.fieldValues,

          status: 'pending',
          redirectUri: d.redirectUri,

          // codeVerifier: supportsPKCE ? OAuthUtils.generateCodeVerifier() : undefined,

          connectionOid: d.connection.oid
        }
      });

      try {
        let authUrlData = await lambdaServerOAuthService.getOauthAuthorizationUrl({
          connection: d.connection,
          authAttempt: authAttempt,
          fields: d.fieldValues || {},
          redirectUri: callbackUrl,
          lambda: lambdaInstance
        });
        if (!authUrlData.authorizationUrl) {
          throw new ServiceError(
            badRequestError({
              message: 'Remote server did not return an authorization URL'
            })
          );
        }

        if (typeof authUrlData.codeVerifier == 'string') {
          await db.providerOAuthConnectionAuthAttempt.updateMany({
            where: { oid: authAttempt.oid },
            data: {
              codeVerifier: authUrlData.codeVerifier
            }
          });
        }

        return {
          type: 'redirect' as const,
          authAttempt,
          redirectUrl: authUrlData.authorizationUrl
        };
      } catch (error: any) {
        if (isServiceError(error)) throw error;

        throw new ServiceError(
          badRequestError({
            message: 'Failed to fetch authorization URL from remote server'
          })
        );
      }
    }

    let config = d.connection.config.config as OAuthConfiguration;
    let supportsPKCE = !!config.code_challenge_methods_supported?.includes('S256');

    await Fabric.fire('provider_oauth.connection.authentication.started:before', {
      context: d.context,
      providerOauthConnection: d.connection
    });

    let authAttempt = await db.providerOAuthConnectionAuthAttempt.create({
      data: {
        id: await ID.generateId('oauthConnectionAuthAttempt'),

        stateIdentifier: await ID.generateId('oauthConnectionAuthAttempt_State'),

        status: 'pending',
        redirectUri: d.redirectUri,

        connectionOid: d.connection.oid,

        codeVerifier: supportsPKCE ? OAuthUtils.generateCodeVerifier() : undefined
      }
    });

    let codeChallenge = authAttempt.codeVerifier
      ? await OAuthUtils.generateCodeChallenge(authAttempt.codeVerifier)
      : undefined;

    await Fabric.fire('provider_oauth.connection.authentication.started:after', {
      context: d.context,
      providerOauthConnection: d.connection,
      authAttempt
    });

    return {
      type: 'redirect' as const,
      authAttempt,
      redirectUrl: OAuthUtils.buildAuthorizationUrl({
        authEndpoint: config.authorization_endpoint,
        clientId: d.connection.clientId,
        redirectUri: callbackUrl,
        scopes: d.connection.config.scopes,
        state: authAttempt.stateIdentifier!,
        codeChallenge
      })
    };
  }

  async completeAuthorization(d: {
    context: Context;

    fullUrl: string;

    response: {
      code?: string;
      state?: string;
      error?: string;
      errorDescription?: string;
    };
  }) {
    if (d.response.error) {
      if (d.response.state) {
        let res = await db.providerOAuthConnectionAuthAttempt.updateMany({
          where: {
            stateIdentifier: d.response.state!,
            status: 'pending'
          },
          data: {
            status: 'failed',
            stateIdentifier: null,
            clientSecret: null,

            errorCode: d.response.error,
            errorMessage:
              d.response.errorDescription ??
              oauthErrorDescriptions[d.response.error] ??
              d.response.error
          }
        });

        if (res.count === 0) {
          throw new ServiceError(
            badRequestError({
              message: 'Invalid authorization attempt',
              description: 'The provided state identifier does not match any pending attempts.'
            })
          );
        }
      }

      throw new ServiceError(
        badRequestError({
          message: 'Authorization failed',
          description: `The provider returned an error: ${d.response.error} - ${d.response.errorDescription}`
        })
      );
    }

    if (!d.response.code || !d.response.state) {
      throw new ServiceError(
        badRequestError({
          message: 'Invalid authorization response',
          description: 'The response must contain a code and state parameter.'
        })
      );
    }

    let attempt = await db.providerOAuthConnectionAuthAttempt.findFirst({
      where: {
        stateIdentifier: d.response.state!,
        status: 'pending',
        createdAt: {
          gte: subMinutes(new Date(), 60 * 2)
        }
      },
      include: {
        connection: {
          include: { config: true }
        }
      }
    });
    if (!attempt) {
      throw new ServiceError(
        badRequestError({
          message: 'Invalid authorization attempt',
          description:
            'The provided state identifier does not match any pending attempts. Maybe the attempt has already been completed or expired.'
        })
      );
    }
    let connection = attempt.connection;

    await Fabric.fire('provider_oauth.connection.authentication.completed:before', {
      context: d.context,
      providerOauthConnection: connection,
      authAttempt: attempt
    });

    let additionalAuthData: Record<string, any> = {};
    let tokenResponse: TokenResponse;
    let profile: ProviderOAuthConnectionProfile | null = null;

    if (connection.config.type == 'json') {
      try {
        tokenResponse = await OAuthUtils.exchangeCodeForTokens({
          tokenEndpoint: connection.config.config.token_endpoint,
          clientId: connection.clientId!,
          clientSecret: connection.clientSecret ?? undefined,
          code: d.response.code!,
          redirectUri: callbackUrl,
          codeVerifier: attempt.codeVerifier ?? undefined,
          config: connection.config.config
        });

        if (!tokenResponse.access_token) {
          throw new Error('Provider did not return `access_token`.');
        }
      } catch (error: any) {
        await db.providerOAuthConnectionAuthAttempt.update({
          where: {
            connectionOid: connection.oid,
            stateIdentifier: d.response.state!,
            status: 'pending'
          },
          data: {
            status: 'failed',
            stateIdentifier: null,
            clientSecret: null,

            errorCode: 'token_exchange_failed',
            errorMessage: `Failed to exchange authorization code for tokens: ${error.message}`
          }
        });

        throw error;
      }

      let providerProfile: UserProfile | null = null;
      if (connection.config.config.userinfo_endpoint) {
        try {
          providerProfile = await OAuthUtils.getUserProfile({
            userInfoEndpoint: connection.config.config.userinfo_endpoint,
            accessToken: tokenResponse.access_token
          });
        } catch (error) {
          // Ignore
        }
      }

      profile = providerProfile
        ? await db.providerOAuthConnectionProfile.upsert({
            where: {
              connectionOid_sub: {
                connectionOid: connection.oid,
                sub: providerProfile.sub
              }
            },
            update: {
              name: providerProfile.name,
              email: providerProfile.email,
              rawProfile: {}, // providerProfile.raw,
              lastUsedAt: new Date()
            },
            create: {
              id: await ID.generateId('oauthConnectionProfile'),

              connectionOid: connection.oid,

              sub: providerProfile.sub,
              name: providerProfile.name,
              email: providerProfile.email,
              rawProfile: {} // providerProfile.raw
            }
          })
        : null;
    } else if (
      connection.config.type == 'managed_server_http' ||
      connection.config.type == 'managed_server_lambda'
    ) {
      if (!connection.config.lambdaServerInstanceForManagedServerOid) {
        throw new Error(
          'WTF - Remote OAuth configuration is missing lambdaServerInstanceForManagedServerOid'
        );
      }

      let lambdaInstance = await db.lambdaServerInstance.findUniqueOrThrow({
        where: { oid: connection.config.lambdaServerInstanceForManagedServerOid },
        include: { instance: { include: { organization: true } } }
      });

      try {
        let callbackData = await lambdaServerOAuthService.handleOAuthCallback({
          fullUrl: d.fullUrl,
          redirectUri: callbackUrl,
          response: d.response,
          connection: connection,
          authAttempt: attempt,
          lambda: lambdaInstance
        });

        let tokenResVal = tokenResponseValidator.validate(callbackData);
        if (!tokenResVal.success) {
          await db.providerOAuthConnectionAuthAttempt.update({
            where: {
              connectionOid: connection.oid,
              stateIdentifier: d.response.state!,
              status: 'pending'
            },
            data: {
              status: 'failed',
              stateIdentifier: null,
              clientSecret: null,
              errorCode: 'token_exchange_failed',
              errorMessage: 'Callback implementation returned an invalid token response'
            }
          });

          throw new ServiceError(
            badRequestError({
              message: 'Callback implementation returned an invalid token response',
              details: tokenResVal.errors
            })
          );
        }

        tokenResponse = {
          access_token: tokenResVal.value.access_token,
          token_type: tokenResVal.value.token_type,
          expires_in: tokenResVal.value.expires_in,
          refresh_token: tokenResVal.value.refresh_token,
          id_token: tokenResVal.value.id_token,
          scope: tokenResVal.value.scope
        };

        additionalAuthData = { ...callbackData };
        for (let key of Object.keys(tokenResponse)) {
          delete additionalAuthData[key];
        }
      } catch (error: any) {
        await db.providerOAuthConnectionAuthAttempt.update({
          where: {
            connectionOid: connection.oid,
            stateIdentifier: d.response.state!,
            status: 'pending'
          },
          data: {
            status: 'failed',
            stateIdentifier: null,
            clientSecret: null,

            errorCode: 'token_exchange_failed',
            errorMessage: `Failed to fetch tokens from remote server`
          }
        });

        throw new ServiceError(
          badRequestError({
            message: 'Failed to fetch tokens from remote server'
          })
        );
      }
    } else {
      throw new Error('WTF - Unknown connection config type');
    }

    let expiresAt = tokenResponse.expires_in
      ? new Date(Date.now() + tokenResponse.expires_in * 1000)
      : undefined;

    let token = await db.providerOAuthConnectionAuthToken.create({
      data: {
        id: await ID.generateId('oauthConnectionAuthToken'),

        accessToken: tokenResponse.access_token,
        tokenType: tokenResponse.token_type,
        expiresAt: expiresAt,
        refreshToken: tokenResponse.refresh_token || null,
        idToken: tokenResponse.id_token || null,
        scope: tokenResponse.scope || null,

        additionalAuthData,
        additionalValuesFromAuthAttempt: attempt.additionalValues,

        connectionOid: connection.oid,
        connectionProfileOid: profile?.oid
      }
    });

    let updatedAuthAttempt = await db.providerOAuthConnectionAuthAttempt.update({
      where: {
        connectionOid: connection.oid,
        stateIdentifier: d.response.state!,
        status: 'pending'
      },
      data: {
        status: 'completed',
        clientSecret: await ID.generateId('oauthConnectionAuthAttempt_ClientSecret'),
        stateIdentifier: null,
        authTokenOid: token.oid,
        profileOid: profile?.oid
      }
    });

    await Fabric.fire('provider_oauth.connection.authentication.completed:after', {
      context: d.context,
      providerOauthConnection: connection,
      authAttempt: updatedAuthAttempt
    });

    let url = new URL(updatedAuthAttempt.redirectUri);
    url.searchParams.set('metorial_token_type', 'oauth');
    url.searchParams.set('metorial_auth_attempt_id', updatedAuthAttempt.id);
    url.searchParams.set('metorial_token', updatedAuthAttempt.clientSecret!);

    return {
      redirectUrl: url.toString(),
      authAttempt: updatedAuthAttempt
    };
  }

  async exchangeAuthAttempt(d: { authAttemptId: string; clientSecret: string }) {
    let authAttempt = await db.providerOAuthConnectionAuthAttempt.findFirst({
      where: {
        clientSecret: d.clientSecret,
        status: 'completed',
        authTokenOid: { not: null },
        createdAt: {
          gte: subMinutes(new Date(), 5)
        }
      },
      include: {
        authToken: true
      }
    });
    if (!authAttempt || !authAttempt.authToken) {
      throw new ServiceError(badRequestError({ message: 'Invalid authorization attempt' }));
    }

    await db.providerOAuthConnectionAuthAttempt.update({
      where: { id: authAttempt.id, clientSecret: authAttempt.clientSecret! },
      data: { stateIdentifier: null, clientSecret: null }
    });

    return await db.providerOAuthConnectionAuthTokenReference.create({
      data: {
        authTokenOid: authAttempt.authToken.oid
      }
    });
  }

  async useAuthToken(
    d: { instance: Instance } & ({ referenceOid: bigint } | { tokenOid: bigint })
  ) {
    return useAuthToken(d);
  }
}

export let providerOauthAuthorizationService = Service.create(
  'providerOauthAuthorization',
  () => new OauthAuthorizationServiceImpl()
).build();
