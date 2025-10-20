import { createCachedFunction } from '@metorial/cache';
import { Context } from '@metorial/context';
import {
  db,
  ID,
  Instance,
  ProviderOAuthConfig,
  ProviderOAuthConnection,
  ProviderOAuthConnectionAuthToken,
  ProviderOAuthConnectionProfile
} from '@metorial/db';
import { ServiceError } from '@metorial/error';
import { badRequestError } from '@metorial/error/src/defaultErrors';
import { Fabric } from '@metorial/fabric';
import { profileService } from '@metorial/module-community';
import { usageService } from '@metorial/module-usage';
import { getSentry } from '@metorial/sentry';
import { Service } from '@metorial/service';
import { getAxiosSsrfFilter } from '@metorial/ssrf';
import axios from 'axios';
import { addMinutes, differenceInDays, differenceInMinutes, subMinutes } from 'date-fns';
import { callbackUrl } from '../const';
import { formSchema } from '../lib/formSchema';
import { oauthErrorDescriptions } from '../lib/oauthErrors';
import { OAuthUtils } from '../lib/oauthUtils';
import { addErrorCheck } from '../queue/errorCheck';
import {
  OAuthConfiguration,
  TokenResponse,
  tokenResponseValidator,
  UserProfile
} from '../types';

let Sentry = getSentry();

let getFormCached = createCachedFunction({
  name: 'pao/aut/form/remot2',
  provider: async (i: { securityToken: string; httpEndpoint: string }) => {
    let form = await axios.post(
      `${i.httpEndpoint}/oauth/authorization-form`,
      { input: {} },
      {
        ...getAxiosSsrfFilter(i.httpEndpoint),
        headers: {
          'metorial-stellar-token': i.securityToken
        }
      }
    );
    if (form.status !== 200 || !form.data.success) {
      throw new ServiceError(
        badRequestError({
          message: 'Failed to fetch authorization form from remote server'
        })
      );
    }

    let valRes = formSchema.validate(form.data.authForm);
    if (!valRes.success) {
      throw new ServiceError(
        badRequestError({
          message: 'Remote server returned an invalid authorization form',
          details: valRes.errors
        })
      );
    }

    return valRes.value;
  },
  ttlSeconds: 60 * 5,
  getHash: i => i.httpEndpoint
});

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

    if (d.connection.config.type == 'managed_server_http') {
      if (
        !d.connection.config.httpEndpoint ||
        !d.connection.config.lambdaServerInstanceForHttpEndpointOid
      ) {
        throw new Error(
          'WTF - Remote OAuth configuration is missing httpEndpoint or lambdaServerInstanceForHttpEndpointOid'
        );
      }

      let lambdaInstance = await db.lambdaServerInstance.findUniqueOrThrow({
        where: { oid: d.connection.config.lambdaServerInstanceForHttpEndpointOid },
        include: { instance: { include: { organization: true } } }
      });

      if (d.connection.config.hasRemoteOauthForm && !d.fieldValues) {
        let form = await getFormCached({
          securityToken: lambdaInstance.securityToken,
          httpEndpoint: d.connection.config.httpEndpoint
        });

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

      if (d.fieldValues) {
        let form = await getFormCached({
          securityToken: lambdaInstance.securityToken,
          httpEndpoint: d.connection.config.httpEndpoint
        });

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

      let authUrlRes = await axios.post(
        `${d.connection.config.httpEndpoint}/oauth/authorization-url`,
        {
          input: {
            fields: d.fieldValues ?? {},
            clientId: d.connection.clientId,
            clientSecret: d.connection.clientSecret,
            state: authAttempt.stateIdentifier,
            redirectUri: callbackUrl
          }
        },
        {
          ...getAxiosSsrfFilter(d.connection.config.httpEndpoint),
          headers: {
            'metorial-stellar-token': lambdaInstance.securityToken
          }
        }
      );
      if (authUrlRes.status !== 200 || !authUrlRes.data.success) {
        throw new ServiceError(
          badRequestError({
            message: 'Failed to fetch authorization URL from remote server'
          })
        );
      }

      if (!authUrlRes.data.authorizationUrl) {
        throw new ServiceError(
          badRequestError({
            message: 'Remote server did not return an authorization URL'
          })
        );
      }

      console.log(authUrlRes.data);

      if (typeof authUrlRes.data.codeVerifier == 'string') {
        await db.providerOAuthConnectionAuthAttempt.updateMany({
          where: { oid: authAttempt.oid },
          data: {
            codeVerifier: authUrlRes.data.codeVerifier
          }
        });
      }

      return {
        type: 'redirect' as const,
        authAttempt,
        redirectUrl: authUrlRes.data.authorizationUrl
      };
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
    } else if (connection.config.type == 'managed_server_http') {
      if (!connection.config.lambdaServerInstanceForHttpEndpointOid) {
        throw new Error(
          'WTF - Remote OAuth configuration is missing lambdaServerInstanceForHttpEndpointOid'
        );
      }

      let lambdaInstance = await db.lambdaServerInstance.findUniqueOrThrow({
        where: { oid: connection.config.lambdaServerInstanceForHttpEndpointOid },
        include: { instance: { include: { organization: true } } }
      });

      let tokenRes = await axios.post<Record<any, any>>(
        `${connection.config.httpEndpoint}/oauth/callback`,
        {
          input: {
            fields: attempt.additionalValues || {},
            code: d.response.code!,
            state: d.response.state!,
            clientId: connection.clientId!,
            clientSecret: connection.clientSecret,
            redirectUri: callbackUrl,
            fullUrl: d.fullUrl,
            codeVerifier: attempt.codeVerifier
          }
        },
        {
          ...getAxiosSsrfFilter(connection.config.httpEndpoint!),
          headers: {
            'metorial-stellar-token': lambdaInstance.securityToken
          }
        }
      );
      if (tokenRes.status !== 200 || !tokenRes.data.success) {
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

      let tokenResVal = tokenResponseValidator.validate(tokenRes.data.authData);
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

      additionalAuthData = { ...tokenRes.data.authData };
      for (let key of Object.keys(tokenResponse)) {
        delete additionalAuthData[key];
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
    let connection: ProviderOAuthConnection & { config: ProviderOAuthConfig };
    let token: ProviderOAuthConnectionAuthToken;

    if ('referenceOid' in d) {
      if (!d.referenceOid) throw new Error('WTF - Invalid reference OID');

      let ref = await db.providerOAuthConnectionAuthTokenReference.findUnique({
        where: { oid: d.referenceOid },
        include: {
          authToken: {
            include: {
              connection: {
                include: {
                  config: true
                }
              }
            }
          }
        }
      });
      if (!ref || !ref.authToken) {
        throw new ServiceError(
          badRequestError({
            message: 'Provider authentication token has expired. Please reauthenticate.'
          })
        );
      }

      connection = ref.authToken.connection;
      token = ref.authToken;
    } else {
      if (!d.tokenOid) throw new Error('WTF - Invalid token OID');

      let tkn = await db.providerOAuthConnectionAuthToken.findUnique({
        where: { oid: d.tokenOid },
        include: {
          connection: {
            include: {
              config: true
            }
          }
        }
      });

      if (!tkn) {
        throw new ServiceError(
          badRequestError({
            message: 'Provider authentication token has expired. Please reauthenticate.'
          })
        );
      }

      connection = tkn.connection;
      token = tkn;
    }

    if (Math.abs(differenceInMinutes(token.lastUsedAt, new Date())) > 5) {
      await db.providerOAuthConnectionAuthToken.updateMany({
        where: { oid: token.oid },
        data: { lastUsedAt: new Date() }
      });
    }

    let expiryWindow = addMinutes(new Date(), 10);

    if (token.expiresAt && token.expiresAt < expiryWindow) {
      token = await (async () => {
        if (!token.refreshToken) {
          // Maybe we have another token for the same profile
          if (token.connectionProfileOid) {
            let otherToken = await db.providerOAuthConnectionAuthToken.findFirst({
              where: {
                connectionProfileOid: token.connectionProfileOid,
                connectionOid: token.connectionOid,

                OR: [
                  { expiresAt: { gt: new Date() } },
                  { expiresAt: null },
                  { refreshToken: { not: null } }
                ]
              }
            });

            if (otherToken) {
              if (Math.abs(differenceInMinutes(otherToken.lastUsedAt, new Date())) > 5) {
                await db.providerOAuthConnectionAuthToken.updateMany({
                  where: { oid: otherToken.oid },
                  data: { lastUsedAt: new Date() }
                });
              }

              // Update the reference to the other token
              if ('referenceOid' in d) {
                await db.providerOAuthConnectionAuthTokenReference.update({
                  where: { oid: d.referenceOid },
                  data: { authTokenOid: otherToken.oid }
                });
              }

              // We can just continue with the other token
              if (!otherToken.expiresAt || otherToken.expiresAt > new Date()) {
                return otherToken;
              }

              // We still need to refresh the token, so let's continue
              // but with the other token
              token = otherToken;
            }
          }

          throw new ServiceError(
            badRequestError({
              message:
                'Provider authentication token has expired and cannot be refreshed. Please reauthenticate.'
            })
          );
        }

        let res: Awaited<ReturnType<typeof OAuthUtils.refreshAccessToken>>;
        let additionalAuthData: Record<string, any> = {};

        if (connection.config.type == 'json') {
          res = await OAuthUtils.refreshAccessToken({
            tokenEndpoint: connection.config.config.token_endpoint,
            clientId: connection.clientId!,
            clientSecret: connection.clientSecret ?? undefined,
            refreshToken: token.refreshToken,
            config: connection.config.config
          });
        } else if (connection.config.type == 'managed_server_http') {
          if (!connection.config.lambdaServerInstanceForHttpEndpointOid) {
            throw new Error(
              'WTF - Remote OAuth configuration is missing lambdaServerInstanceForHttpEndpointOid'
            );
          }

          let lambdaInstance = await db.lambdaServerInstance.findUniqueOrThrow({
            where: { oid: connection.config.lambdaServerInstanceForHttpEndpointOid },
            include: { instance: { include: { organization: true } } }
          });

          let tokenRes = await axios.post<Record<any, any>>(
            `${connection.config.httpEndpoint}/oauth/refresh`,
            {
              input: {
                redirectUri: callbackUrl,
                refreshToken: token.refreshToken,
                clientId: connection.clientId!,
                clientSecret: connection.clientSecret,
                fields: token.additionalValuesFromAuthAttempt ?? {}
              }
            },
            {
              ...getAxiosSsrfFilter(connection.config.httpEndpoint!),
              headers: {
                'metorial-stellar-token': lambdaInstance.securityToken
              }
            }
          );
          if (tokenRes.status !== 200 || !tokenRes.data.success) {
            res = { ok: false as const, message: 'Failed to fetch tokens from remote server' };
          } else {
            let tokenResVal = tokenResponseValidator.validate(tokenRes.data.authData);
            if (!tokenResVal.success) {
              res = {
                ok: false as const,
                message: 'Callback implementation returned an invalid token response'
              };
            } else {
              let tokenResponse = {
                access_token: tokenResVal.value.access_token,
                token_type: tokenResVal.value.token_type,
                expires_in: tokenResVal.value.expires_in,
                refresh_token: tokenResVal.value.refresh_token,
                id_token: tokenResVal.value.id_token,
                scope: tokenResVal.value.scope
              };

              additionalAuthData = { ...tokenRes.data.authData };
              for (let key of Object.keys(tokenResponse)) {
                delete additionalAuthData[key];
              }

              res = {
                ok: true as const,
                response: tokenResponse
              };
            }
          }
        } else {
          throw new Error('WTF - Unknown connection config type');
        }

        if (!res.ok) {
          (async () => {
            let update = await db.providerOAuthConnectionAuthToken.update({
              where: { oid: token.oid },
              data: {
                firstErrorAt: token.firstErrorAt ?? new Date(),
                lastErrorAt: new Date(),
                errorCount: { increment: 1 },
                errorDisabledAt:
                  (token.errorDisabledAt ??
                  (token.firstErrorAt &&
                    Math.abs(differenceInDays(token.firstErrorAt, new Date())) > 1 &&
                    token.errorCount > 5))
                    ? new Date()
                    : null
              }
            });

            await addErrorCheck(connection.id);

            if (update.errorDisabledAt && !token.errorDisabledAt) {
              await db.providerOAuthConnectionAuthAttempt.updateMany({
                where: { authTokenOid: token.oid },
                data: { associatedTokenErrorDisabledAt: update.errorDisabledAt }
              });
            }
          })().catch(e => Sentry.captureException(e));

          throw new ServiceError(
            badRequestError({
              message: `Failed to refresh access token`
            })
          );
        }

        let tokenResponse = res.response;

        return await db.providerOAuthConnectionAuthToken.update({
          where: { oid: token.oid },
          data: {
            accessToken: tokenResponse.access_token,
            tokenType: tokenResponse.token_type,
            expiresAt: tokenResponse.expires_in
              ? new Date(Date.now() + tokenResponse.expires_in * 1000)
              : null,
            refreshToken: tokenResponse.refresh_token || undefined,
            idToken: tokenResponse.id_token || undefined,
            scope: tokenResponse.scope || undefined,
            lastUsedAt: new Date(),
            additionalAuthData: {
              ...(token.additionalAuthData ?? {}),
              ...additionalAuthData
            }
          }
        });
      })();
    }

    if (token.errorCount) {
      (async () => {
        await db.providerOAuthConnectionAuthToken.updateMany({
          where: { oid: token.oid },
          data: {
            firstErrorAt: null,
            lastErrorAt: null,
            errorCount: 0,
            errorDisabledAt: null
          }
        });

        await db.providerOAuthConnectionAuthAttempt.updateMany({
          where: { authTokenOid: token.oid },
          data: { associatedTokenErrorDisabledAt: null }
        });
      })().catch(e => Sentry.captureException(e));
    }

    (async () =>
      usageService.ingestUsageRecord({
        owner: {
          id: d.instance.id,
          type: 'instance'
        },
        entity: {
          id: connection.id,
          type: 'provider_oauth_connection'
        },
        type: 'provider_oauth_connection.created'
      }))().catch(e => Sentry.captureException(e));

    return {
      token,

      id: token.id,
      accessToken: token.accessToken,
      tokenType: token.tokenType,
      expiresAt: token.expiresAt,
      idToken: token.idToken,
      scope: token.scope,
      additionalAuthData: token.additionalAuthData,
      fields: token.additionalValuesFromAuthAttempt,
      connection
    };
  }
}

export let providerOauthAuthorizationService = Service.create(
  'providerOauthAuthorization',
  () => new OauthAuthorizationServiceImpl()
).build();
