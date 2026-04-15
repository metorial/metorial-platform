import { badRequestError, ServiceError } from '@lowerdeck/error';
import { createHono } from '@lowerdeck/hono';
import { generateCustomId } from '@lowerdeck/id';
import { v } from '@lowerdeck/validation';
import * as Cookies from 'cookie';
import { env } from '../../../env';
import { tickets } from '../../../lib/tickets';
import { validateRedirectUrl } from '../../../lib/validateRedirectUrl';
import { authService } from '../../../services/auth';
import { deviceService } from '../../../services/device';
import { ssoService } from '../../../services/sso';
import { resolveApp } from '../lib/resolveApp';
import { baseCookieOpts, SESSION_ID_COOKIE_NAME } from '../middleware/device';

export let authHooksApp = createHono()
  .get('/oauth/:ticket', async ctx => {
    let ticket = await tickets.decode(
      ctx.req.param('ticket'),
      v.object({
        type: v.literal('oauth'),
        appClientId: v.string(),
        provider: v.enumOf(['google', 'github']),
        deviceId: v.string(),
        redirectUrl: v.string()
      })
    );

    let app = await resolveApp(ticket.appClientId);

    let state = generateCustomId('oauth_state', 50);

    ctx.res.headers.append(
      'Set-Cookie',
      Cookies.serialize(
        `metorial_oauth_state_${state}`,
        JSON.stringify({
          appClientId: ticket.appClientId,
          provider: ticket.provider,
          redirectUrl: ticket.redirectUrl,
          deviceId: ticket.deviceId
        }),
        {
          path: '/'
        }
      )
    );

    let url = await authService.getSocialProviderAuthUrl({
      provider: ticket.provider,
      state,
      app
    });

    return ctx.redirect(url);
  })
  .get('/oauth-response/:provider', async ctx => {
    let provider = ctx.req.param('provider');
    let code = ctx.req.query('code');
    let state = ctx.req.query('state');

    if (!code || !state) {
      throw new ServiceError(badRequestError({ message: 'Missing code or state' }));
    }

    let cookieHeader = ctx.req.header('cookie') ?? '';
    let cookies = Cookies.parse(cookieHeader);
    let stateCookieName = `metorial_oauth_state_${state}`;
    let stateCookie = cookies[stateCookieName];
    if (!stateCookie) {
      throw new ServiceError(badRequestError({ message: 'Invalid OAuth state' }));
    }

    let stateData = JSON.parse(stateCookie) as {
      appClientId: string;
      provider: string;
      redirectUrl: string;
      deviceId: string;
    };

    let app = await resolveApp(stateData.appClientId);
    let device = await deviceService.dangerouslyGetDeviceOnlyById({
      deviceId: stateData.deviceId
    });

    let ip = (ctx.req.header('x-forwarded-for') ?? ctx.req.header('x-real-ip') ?? '')
      .split(',')[0]!
      .trim();
    let ua = ctx.req.header('user-agent') ?? '';

    let res = await authService.authWithSocialProviderToken({
      provider: provider as 'google' | 'github',
      code,
      app,
      device,
      redirectUrl: stateData.redirectUrl,
      context: { ip, ua }
    });

    if (res.type == 'auth_attempt') {
      validateRedirectUrl(res.authAttempt.redirectUrl, app.redirectDomains);

      let session = await deviceService.exchangeAuthAttemptForSession({
        authAttempt: res.authAttempt
      });

      ctx.res.headers.append(
        'Set-Cookie',
        Cookies.serialize(SESSION_ID_COOKIE_NAME, session.id, baseCookieOpts)
      );

      let redirectUrl = new URL(res.authAttempt.redirectUrl);
      redirectUrl.searchParams.set('code', session.authorizationCode);
      return ctx.redirect(redirectUrl.toString());
    }

    let authUrl = new URL(`${env.service.ARES_AUTH_URL}/auth-intent`);
    authUrl.searchParams.set('authIntentId', res.authIntent.id);
    authUrl.hash = `authIntentClientSecret=${res.authIntent.clientSecret}`;

    ctx.res.headers.append(
      'Set-Cookie',
      Cookies.serialize(stateCookieName, '', {
        path: '/',
        expires: new Date(0)
      })
    );

    return ctx.redirect(authUrl.toString());
  })
  .get('/sso/:ticket', async ctx => {
    let ticket = await tickets.decode(
      ctx.req.param('ticket'),
      v.object({
        type: v.literal('sso'),
        appClientId: v.string(),
        deviceId: v.string(),
        ssoTenantId: v.string(),
        redirectUrl: v.string(),
        email: v.optional(v.string())
      })
    );

    let app = await resolveApp(ticket.appClientId);

    let tenant = await ssoService.getTenantById({ tenantId: ticket.ssoTenantId });
    if (tenant.appOid !== app.oid && !tenant.isGlobal) {
      throw new ServiceError(
        badRequestError({ message: 'SSO tenant does not belong to this app' })
      );
    }

    let ssoAuth = await ssoService.createAuth({
      tenant,
      input: {
        redirectUri: `${env.service.ARES_AUTH_URL}/metorial-ares/hooks/sso-response`,
        state: generateCustomId('sso_state', 50),
        email: ticket.email
      }
    });

    ctx.res.headers.append(
      'Set-Cookie',
      Cookies.serialize(
        `metorial_sso_state_${ssoAuth.id}`,
        JSON.stringify({
          appClientId: ticket.appClientId,
          deviceId: ticket.deviceId,
          redirectUrl: ticket.redirectUrl
        }),
        {
          path: '/'
        }
      )
    );

    return ctx.redirect(
      `${env.service.ARES_SSO_URL}/sso/auth?client_secret=${ssoAuth.clientSecret}`
    );
  })
  .get('/sso-response', async ctx => {
    let tenantId = ctx.req.query('tenant_id');
    let authId = ctx.req.query('auth_id');

    if (!tenantId || !authId) {
      throw new ServiceError(badRequestError({ message: 'Missing tenant_id or auth_id' }));
    }

    let { tenant, connection, userProfile } = await ssoService.completeAuth({
      authId
    });

    let cookieHeader = ctx.req.header('cookie') ?? '';
    let cookies = Cookies.parse(cookieHeader);
    let stateCookie = cookies[`metorial_sso_state_${authId}`];
    if (!stateCookie) {
      throw new ServiceError(badRequestError({ message: 'Invalid SSO state' }));
    }

    let stateData = JSON.parse(stateCookie) as {
      appClientId: string;
      deviceId: string;
      redirectUrl: string;
    };

    let app = await resolveApp(stateData.appClientId);
    let device = await deviceService.dangerouslyGetDeviceOnlyById({
      deviceId: stateData.deviceId
    });

    let ip = (ctx.req.header('x-forwarded-for') ?? ctx.req.header('x-real-ip') ?? '')
      .split(',')[0]!
      .trim();
    let ua = ctx.req.header('user-agent') ?? '';

    let authAttempt = await authService.authWithSso({
      ssoUser: {
        email: userProfile.email,
        firstName: userProfile.firstName,
        lastName: userProfile.lastName
      },
      ssoConnectionId: connection.id,
      ssoUid: userProfile.uid,
      ssoTenant: tenant,
      ssoUserProfile: userProfile,
      context: { ip, ua },
      redirectUrl: stateData.redirectUrl,
      device,
      app
    });

    validateRedirectUrl(authAttempt.redirectUrl, app.redirectDomains);

    let session = await deviceService.exchangeAuthAttemptForSession({
      authAttempt
    });

    ctx.res.headers.append(
      'Set-Cookie',
      Cookies.serialize(SESSION_ID_COOKIE_NAME, session.id, baseCookieOpts)
    );

    let redirectUrl = new URL(authAttempt.redirectUrl);
    redirectUrl.searchParams.set('code', session.authorizationCode);
    return ctx.redirect(redirectUrl.toString());
  })

  .get('/auth-attempt/:ticket', async ctx => {
    let ticket = await tickets.decode(
      ctx.req.param('ticket'),
      v.object({
        type: v.literal('auth_attempt'),
        authAttemptId: v.string(),
        authAttemptClientSecret: v.optional(v.string())
      })
    );

    let authAttempt = await authService.dangerouslyGetAuthAttemptOnlyById({
      authAttemptId: ticket.authAttemptId
    });

    let authorizationCode: string | undefined;

    if (authAttempt.status != 'consumed') {
      if (authAttempt.clientSecret != ticket.authAttemptClientSecret) {
        throw new ServiceError(
          badRequestError({
            message: 'Auth attempt not consumed'
          })
        );
      }

      let session = await deviceService.exchangeAuthAttemptForSession({
        authAttempt
      });

      authorizationCode = session.authorizationCode;

      ctx.res.headers.append(
        'Set-Cookie',
        Cookies.serialize(SESSION_ID_COOKIE_NAME, session.id, baseCookieOpts)
      );
    } else {
      authorizationCode = authAttempt.authorizationCode ?? undefined;
    }

    let redirectUrl = new URL(authAttempt.redirectUrl);
    if (authorizationCode) {
      redirectUrl.searchParams.set('code', authorizationCode);
    }
    return ctx.redirect(redirectUrl.toString());
  });
