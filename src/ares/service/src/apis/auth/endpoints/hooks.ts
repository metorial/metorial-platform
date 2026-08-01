import { badRequestError, ServiceError } from '@lowerdeck/error';
import { createHono, type Context as HonoContext } from '@lowerdeck/hono';
import { generateCustomId } from '@lowerdeck/id';
import { v } from '@lowerdeck/validation';
import * as Cookies from 'cookie';
import { randomBytes } from 'crypto';
import { db } from '../../../db';
import { env } from '../../../env';
import { getRequestContext } from '../../../lib/context';
import { createDelegationCodeChallenge } from '../../../lib/ssoDelegationProtocol';
import { tickets } from '../../../lib/tickets';
import { validateRedirectUrl } from '../../../lib/validateRedirectUrl';
import { authService } from '../../../services/auth';
import { deviceService } from '../../../services/device';
import { ssoAuthService } from '../../../services/sso/auth';
import { ssoDelegationClient } from '../../../services/sso/delegationClient';
import {
  SsoDomainNotAllowedError,
  ssoDomainPolicyService
} from '../../../services/sso/domainPolicy';
import { ssoIdentityService } from '../../../services/sso/identity';
import { ssoLoginService } from '../../../services/sso/login';
import { ssoDomainNotAllowedHtml } from '../../sso/pages/domain-not-allowed';
import { resolveClient } from '../lib/resolveApp';
import { baseCookieOpts, SESSION_ID_COOKIE_NAME } from '../middleware/device';

let getAccountLoginUrl = (d: {
  accountClientId: string;
  redirectUrl: string;
  email?: string | null;
  reason?: 'social_login_disabled' | 'account_sso_required';
}) => {
  let authUrl = new URL(`${env.service.ARES_AUTH_URL}/login`);
  authUrl.searchParams.set('client_id', d.accountClientId);
  authUrl.searchParams.set('redirect_url', d.redirectUrl);
  authUrl.searchParams.set('auth_error', d.reason ?? 'social_login_disabled');
  if (d.email) authUrl.searchParams.set('email', d.email);
  return authUrl.toString();
};

let createCodeVerifier = () => randomBytes(32).toString('base64url');

// Hono hands downstream errors to the app-level handler, which answers JSON.
// These hooks are reached by a browser redirect, so a blocked domain has to be
// caught in the handler and rendered as a page.
let renderSsoDomainError = (ctx: HonoContext, error: unknown) => {
  if (error instanceof SsoDomainNotAllowedError) {
    return ctx.html(ssoDomainNotAllowedHtml(error), 403);
  }
  throw error;
};

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

    let { app, account } = await resolveClient(ticket.appClientId);
    validateRedirectUrl(ticket.redirectUrl, app.redirectDomains);
    if (account && !account.allowSocialLogin) {
      return ctx.redirect(
        getAccountLoginUrl({
          accountClientId: account.clientId,
          redirectUrl: ticket.redirectUrl
        })
      );
    }

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

    let { app, account } = await resolveClient(stateData.appClientId);
    validateRedirectUrl(stateData.redirectUrl, app.redirectDomains);
    if (account && !account.allowSocialLogin) {
      return ctx.redirect(
        getAccountLoginUrl({
          accountClientId: account.clientId,
          redirectUrl: stateData.redirectUrl
        })
      );
    }
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
      context: { ip, ua },
      account
    });

    if (res.type == 'social_disabled') {
      return ctx.redirect(
        getAccountLoginUrl({
          accountClientId: res.account.clientId,
          redirectUrl: stateData.redirectUrl,
          email: res.email
        })
      );
    }

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
    try {
      let ticket = await tickets.decode(
        ctx.req.param('ticket'),
        v.object({
          type: v.literal('sso'),
          appClientId: v.string(),
          deviceId: v.string(),
          ssoTenantId: v.string(),
          ssoConnectionId: v.optional(v.string()),
          redirectUrl: v.string(),
          email: v.optional(v.string())
        })
      );

      let { app, account: clientAccount } = await resolveClient(ticket.appClientId);
      validateRedirectUrl(ticket.redirectUrl, app.redirectDomains);
      let { account, tenant, connection } = await authService.resolveSsoConnection({
        app,
        account: clientAccount,
        tenantId: ticket.ssoTenantId,
        connectionId: ticket.ssoConnectionId,
        email: ticket.email
      });
      let ssoAuth = await ssoAuthService.createAuth({
        tenant,
        account,
        connection: connection ?? undefined,
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

      if (tenant.importedDelegationOid) {
        let imported = await db.ssoImportedDelegation.findUnique({
          where: { oid: tenant.importedDelegationOid },
          include: {
            remoteInstance: true,
            localExportedDelegation: true
          }
        });
        if (!imported || imported.status !== 'active') {
          throw new ServiceError(badRequestError({ message: 'SSO delegation is disabled' }));
        }

        let codeVerifier = createCodeVerifier();
        await db.ssoAuth.update({
          where: { oid: ssoAuth.oid },
          data: { codeVerifier }
        });

        let authorizationUrl = new URL(imported.remoteInstance.authorizationEndpointUrl);
        authorizationUrl.searchParams.set('client_id', imported.clientId);
        authorizationUrl.searchParams.set(
          'response_type',
          'urn:metorial.com:ares:sso-delegation'
        );
        authorizationUrl.searchParams.set(
          'redirect_uri',
          `${env.service.ARES_AUTH_URL}/metorial-ares/hooks/sso-delegation-response`
        );
        authorizationUrl.searchParams.set('state', ssoAuth.state);
        authorizationUrl.searchParams.set(
          'code_challenge',
          createDelegationCodeChallenge(codeVerifier)
        );
        authorizationUrl.searchParams.set('code_challenge_method', 'S256');
        if (connection?.sourceId) {
          authorizationUrl.searchParams.set('connection_id', connection.sourceId);
        }
        if (ticket.email) authorizationUrl.searchParams.set('login_hint', ticket.email);
        return ctx.redirect(authorizationUrl.toString());
      }

      return ctx.redirect(
        `${env.service.ARES_SSO_URL}/sso/auth?client_secret=${ssoAuth.clientSecret}`
      );
    } catch (error) {
      return renderSsoDomainError(ctx, error);
    }
  })
  .get('/sso-delegation-response', async ctx => {
    try {
      let code = ctx.req.query('code');
      let state = ctx.req.query('state');
      if (!code || !state) {
        throw new ServiceError(
          badRequestError({ message: 'Missing delegation code or state' })
        );
      }

      let auth = await db.ssoAuth.findUnique({
        where: { state },
        include: {
          account: true,
          tenant: {
            include: {
              importedDelegation: {
                include: {
                  remoteInstance: true,
                  localExportedDelegation: true
                }
              }
            }
          }
        }
      });
      let imported = auth?.tenant.importedDelegation;
      if (
        !auth ||
        !imported ||
        imported.status !== 'active' ||
        auth.status !== 'pending' ||
        (auth.expiresAt && auth.expiresAt <= new Date()) ||
        !auth.codeVerifier
      ) {
        throw new ServiceError(badRequestError({ message: 'Invalid delegation state' }));
      }

      let redirectUri = `${env.service.ARES_AUTH_URL}/metorial-ares/hooks/sso-delegation-response`;
      let snapshot = await ssoDelegationClient.exchangeCode({
        imported,
        code,
        redirectUri,
        codeVerifier: auth.codeVerifier
      });
      if (
        snapshot.type !== 'identity' ||
        snapshot.delegation.id !== imported.sourceDelegationId ||
        snapshot.delegation.clientId !== imported.clientId ||
        snapshot.tenant.id !== imported.sourceTenantId ||
        !snapshot.connection ||
        !snapshot.userProfile
      ) {
        throw new ServiceError(
          badRequestError({ message: 'Delegation identity did not match the import' })
        );
      }

      let connection = await db.ssoConnection.findFirst({
        where: {
          importedDelegationOid: imported.oid,
          sourceId: snapshot.connection.id,
          tenantOid: auth.tenantOid,
          status: 'active'
        }
      });
      if (!connection) {
        throw new ServiceError(
          badRequestError({ message: 'Delegated SSO connection is unavailable' })
        );
      }

      let profileData = snapshot.userProfile;

      // The delegated instance authenticated against its own IdP and has no
      // account domains of its own, so the asserted email is only checked here.
      await ssoDomainPolicyService.assertEmailAllowed({
        tenant: auth.tenant,
        connection,
        account: auth.account,
        email: profileData.email,
        context: getRequestContext(ctx)
      });

      let user = await ssoIdentityService.upsertUser({
        tenant: auth.tenant,
        email: profileData.email,
        firstName: profileData.firstName,
        lastName: profileData.lastName
      });
      let profile = await ssoIdentityService.upsertUserProfile({
        tenant: auth.tenant,
        connection,
        user,
        data: {
          email: profileData.email,
          uid: profileData.uid,
          uidHash: profileData.uidHash,
          sub: profileData.sub ?? undefined,
          firstName: profileData.firstName,
          lastName: profileData.lastName,
          roles: profileData.roles,
          groups: profileData.groups,
          raw: profileData.raw
        }
      });
      await db.ssoAuth.update({
        where: { oid: auth.oid },
        data: {
          status: 'completed',
          connectionOid: connection.oid,
          userOid: user.oid,
          userProfileOid: profile.oid
        }
      });

      let next = new URL(`${env.service.ARES_AUTH_URL}/metorial-ares/hooks/sso-response`);
      next.searchParams.set('tenant_id', auth.tenant.id);
      next.searchParams.set('auth_id', auth.id);
      return ctx.redirect(next.toString());
    } catch (error) {
      return renderSsoDomainError(ctx, error);
    }
  })
  .get('/sso-response', async ctx => {
    try {
      let tenantId = ctx.req.query('tenant_id');
      let authId = ctx.req.query('auth_id');

      if (!tenantId || !authId) {
        throw new ServiceError(badRequestError({ message: 'Missing tenant_id or auth_id' }));
      }

      let { tenant, account, connection, userProfile } = await ssoAuthService.completeAuth({
        authId,
        tenantId
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

      let resolvedClient = await resolveClient(stateData.appClientId);
      let app = resolvedClient.app;
      validateRedirectUrl(stateData.redirectUrl, app.redirectDomains);
      if (resolvedClient.account && resolvedClient.account.oid != account?.oid) {
        throw new ServiceError(badRequestError({ message: 'SSO account context changed' }));
      }
      let emailAccount = await authService.resolveAccountForEmail({
        app,
        account,
        email: userProfile.email
      });
      if (!account && emailAccount.account) {
        return ctx.redirect(
          getAccountLoginUrl({
            accountClientId: emailAccount.account.clientId,
            redirectUrl: stateData.redirectUrl,
            email: userProfile.email,
            reason: 'account_sso_required'
          })
        );
      }
      let device = await deviceService.dangerouslyGetDeviceOnlyById({
        deviceId: stateData.deviceId
      });

      let { authAttempt, session } = await ssoLoginService.completeLogin({
        tenant,
        connection,
        userProfile,
        app,
        account,
        device,
        context: getRequestContext(ctx),
        redirectUrl: stateData.redirectUrl
      });

      ctx.res.headers.append(
        'Set-Cookie',
        Cookies.serialize(SESSION_ID_COOKIE_NAME, session.id, baseCookieOpts)
      );

      let redirectUrl = new URL(authAttempt.redirectUrl);
      redirectUrl.searchParams.set('code', session.authorizationCode);
      return ctx.redirect(redirectUrl.toString());
    } catch (error) {
      return renderSsoDomainError(ctx, error);
    }
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
