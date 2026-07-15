import { badRequestError, ServiceError } from '@lowerdeck/error';
import { v } from '@lowerdeck/validation';
import { env } from '../../../env';
import { getAccountSsoClientId } from '../../../lib/accountPolicy';
import { tickets } from '../../../lib/tickets';
import { validateRedirectUrl } from '../../../lib/validateRedirectUrl';
import { authService } from '../../../services/auth';
import { deviceService } from '../../../services/device';
import { publicApp } from '../_app';
import { resolveClient } from '../lib/resolveApp';
import { deviceApp } from '../middleware/device';
import { authAttemptPresenter, authIntentPresenter, deviceUserPresenter } from '../presenters';

export let authenticationController = publicApp.controller({
  boot: deviceApp
    .handler()
    .input(
      v.object({
        clientId: v.string()
      })
    )
    .do(async ({ device, input }) => {
      let { app, account } = await resolveClient(input.clientId);

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
          clientId: input.clientId,
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

  start: deviceApp
    .handler()
    .input(
      v.union([
        v.object({
          type: v.literal('email'),
          clientId: v.string(),
          email: v.string(),
          redirectUrl: v.string(),
          captchaToken: v.optional(v.string())
        }),
        v.object({
          type: v.literal('oauth'),
          clientId: v.string(),
          provider: v.enumOf(['google', 'github']),
          redirectUrl: v.string()
        }),
        v.object({
          type: v.literal('sso'),
          clientId: v.string(),
          ssoTenantId: v.string(),
          ssoConnectionId: v.optional(v.string()),
          email: v.optional(v.string()),
          redirectUrl: v.string()
        }),
        v.object({
          type: v.literal('session'),
          clientId: v.string(),
          userOrSessionId: v.string(),
          redirectUrl: v.string()
        })
      ])
    )
    .do(async ({ context, device, input }) => {
      let { app, account } = await resolveClient(input.clientId);

      validateRedirectUrl(input.redirectUrl, app.redirectDomains);

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
          redirectUrl: input.redirectUrl,
          captchaToken: input.type == 'email' ? input.captchaToken : undefined,
          app,
          account
        });

        if (res.type == 'hook') {
          return {
            type: 'hook' as const,
            url: `${env.service.ARES_AUTH_URL}/metorial-ares/hooks/sso/${await tickets.encode({
              type: 'sso',
              appClientId: getAccountSsoClientId(input.clientId, res.account?.clientId),
              deviceId: device.id,
              ssoTenantId: res.ssoTenant.id,
              ssoConnectionId: res.ssoConnection.id,
              redirectUrl: input.redirectUrl,
              email: res.email
            })}`
          };
        } else if (res.type == 'selection') {
          return {
            type: 'selection' as const,
            clientId: res.account?.clientId ?? input.clientId,
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
            appClientId: input.clientId,
            provider: input.provider,
            deviceId: device.id,
            redirectUrl: input.redirectUrl
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
            appClientId: input.clientId,
            deviceId: device.id,
            ssoTenantId: input.ssoTenantId,
            ssoConnectionId: connection?.id,
            email: input.email,
            redirectUrl: input.redirectUrl
          })}`
        };
      }

      throw new Error('Invalid input');
    })
});
