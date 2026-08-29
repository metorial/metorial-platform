import { badRequestError, ServiceError } from '@lowerdeck/error';
import { v } from '@lowerdeck/validation';
import { env } from '../../../env';
import { getAccountSsoClientId } from '../../../lib/accountPolicy';
import { resolveAppRedirectUrl } from '../../../lib/appRedirect';
import { tickets } from '../../../lib/tickets';
import { authService } from '../../../services/auth';
import { deviceService } from '../../../services/device';
import { publicApp } from '../_app';
import { resolveClientOrDefault } from '../lib/resolveApp';
import { deviceApp } from '../middleware/device';
import { authAttemptPresenter, authIntentPresenter, deviceUserPresenter } from '../presenters';

export let authenticationController = publicApp.controller({
  boot: deviceApp
    .handler()
    .input(
      v.object({
        clientId: v.optional(v.string())
      })
    )
    .do(async ({ device, input }) => {
      let { app, account } = await resolveClientOrDefault(input.clientId);

      let users = await deviceService.getLoggedInAndLoggedOutUsersForDevice({
        device,
        app,
        account
      });

      let { options } = await authService.getAuthOptions({ app, account });

      return {
        options,
        client: {
          type: account ? ('account' as const) : ('app' as const),
          clientId: account?.clientId ?? app.clientId,
          account: account
            ? {
                id: account.id,
                name: account.name,
                identifier: account.identifier,
                allowEmailLogin: account.allowEmailLogin,
                allowSocialLogin: account.allowSocialLogin
              }
            : null
        },

        captcha: env.turnstile.TURNSTILE_SITE_KEY
          ? {
              type: 'required' as const,
              siteKey: env.turnstile.TURNSTILE_SITE_KEY
            }
          : null,

        defaultRedirectUrl: app.defaultRedirectUrl,

        users: await Promise.all(users.map(deviceUserPresenter))
      };
    }),

  userSelect: deviceApp
    .handler()
    .input(
      v.object({
        clientId: v.optional(v.string()),
        email: v.string({ modifiers: [v.maxLength(320)] })
      })
    )
    .do(async ({ input }) => {
      let { app, account: clientAccount } = await resolveClientOrDefault(input.clientId);
      let { options, account } = await authService.getUserAuthOptions({
        app,
        account: clientAccount,
        email: input.email
      });

      return {
        email: input.email.trim().toLowerCase(),
        options,
        clientId: getAccountSsoClientId(
          clientAccount?.clientId ?? app.clientId,
          account?.clientId
        ),
        account: account
          ? {
              id: account.id,
              name: account.name,
              identifier: account.identifier,
              allowEmailLogin: account.allowEmailLogin,
              allowSocialLogin: account.allowSocialLogin
            }
          : null
      };
    }),

  start: deviceApp
    .handler()
    .input(
      v.union([
        v.object({
          type: v.literal('email'),
          clientId: v.optional(v.string()),
          email: v.string(),
          redirectUrl: v.string(),
          captchaToken: v.optional(v.string())
        }),
        v.object({
          type: v.literal('oauth'),
          clientId: v.optional(v.string()),
          provider: v.enumOf(['google', 'github']),
          redirectUrl: v.string()
        }),
        v.object({
          type: v.literal('sso'),
          clientId: v.optional(v.string()),
          ssoTenantId: v.string(),
          ssoConnectionId: v.optional(v.string()),
          email: v.optional(v.string()),
          redirectUrl: v.string()
        }),
        v.object({
          type: v.literal('session'),
          clientId: v.optional(v.string()),
          userOrSessionId: v.string(),
          redirectUrl: v.string()
        })
      ])
    )
    .do(async ({ context, device, input }) => {
      let { app, account } = await resolveClientOrDefault(input.clientId);
      let clientId = account?.clientId ?? app.clientId;

      let redirectUrl = resolveAppRedirectUrl({
        app,
        redirectUrl: input.redirectUrl
      });

      if (input.type == 'email' || input.type == 'session') {
        let email = input.type == 'email' ? input.email : undefined;

        if (input.type == 'session') {
          let sessions = await deviceService.getLoggedInAndLoggedOutUsersForDevice({
            device,
            app,
            account
          });
          let session = sessions.find(
            s => s.id == input.userOrSessionId || s.user.id == input.userOrSessionId
          );
          if (!session) {
            throw new ServiceError(badRequestError({ message: 'User not logged in' }));
          }

          email = session.user.email;
        }

        if (!email) throw new Error('WTF');

        let res = await authService.authWithEmail({
          context: {
            ip: context.ip,
            ua: context.ua ?? ''
          },
          device,
          email,
          redirectUrl,
          captchaToken: input.type == 'email' ? input.captchaToken : undefined,
          app,
          account
        });

        if (res.type == 'hook') {
          return {
            type: 'hook' as const,
            url: `${env.service.ARES_AUTH_URL}/metorial-ares/hooks/sso/${await tickets.encode({
              type: 'sso',
              appClientId: getAccountSsoClientId(clientId, res.account?.clientId),
              deviceId: device.id,
              ssoTenantId: res.ssoTenant.id,
              ssoConnectionId: res.ssoConnection.id,
              redirectUrl,
              email: res.email
            })}`
          };
        } else if (res.type == 'selection') {
          return {
            type: 'selection' as const,
            clientId: res.account?.clientId ?? clientId,
            email: res.email,
            account: res.account
              ? {
                  id: res.account.id,
                  name: res.account.name,
                  identifier: res.account.identifier,
                  allowEmailLogin: res.account.allowEmailLogin,
                  allowSocialLogin: res.account.allowSocialLogin
                }
              : null,
            options: res.options
          };
        } else if (res.type == 'auth_attempt') {
          return {
            type: 'auth_attempt' as const,
            authAttempt: authAttemptPresenter(res.authAttempt)
          };
        } else if (res.type == 'auth_intent') {
          let fullAuthIntent = await authService.getAuthIntent({
            authIntentId: res.authIntent.id,
            clientSecret: res.authIntent.clientSecret
          });

          return {
            type: 'auth_intent' as const,
            authIntent: authIntentPresenter(fullAuthIntent)
          };
        }
      }

      if (input.type == 'oauth') {
        return {
          type: 'hook' as const,
          url: `${env.service.ARES_AUTH_URL}/metorial-ares/hooks/oauth/${await tickets.encode({
            type: 'oauth',
            appClientId: clientId,
            provider: input.provider,
            deviceId: device.id,
            redirectUrl
          })}`
        };
      }

      if (input.type == 'sso') {
        let { connection } = await authService.resolveSsoConnection({
          app,
          account,
          tenantId: input.ssoTenantId,
          connectionId: input.ssoConnectionId,
          email: input.email
        });
        return {
          type: 'hook' as const,
          url: `${env.service.ARES_AUTH_URL}/metorial-ares/hooks/sso/${await tickets.encode({
            type: 'sso',
            appClientId: clientId,
            deviceId: device.id,
            ssoTenantId: input.ssoTenantId,
            ssoConnectionId: connection?.id,
            email: input.email,
            redirectUrl
          })}`
        };
      }

      throw new Error('Invalid input');
    })
});
