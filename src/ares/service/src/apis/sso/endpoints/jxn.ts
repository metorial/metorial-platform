import { createHono } from '@lowerdeck/hono';
import * as Cookies from 'cookie';
import { db } from '../../../db';
import { getRequestContext } from '../../../lib/context';
import { getSamlConnectionDefaultRedirectUrl } from '../../../lib/ssoRedirect';
import { deviceService } from '../../../services/device';
import {
  SsoDomainNotAllowedError,
  ssoDomainPolicyService
} from '../../../services/sso/domainPolicy';
import { ssoIdentityService } from '../../../services/sso/identity';
import { ssoLoginService } from '../../../services/sso/login';
import { jackson } from '../../../lib/jackson';
import {
  baseCookieOpts,
  DEVICE_TOKEN_COOKIE_NAME,
  parseDeviceToken,
  SESSION_ID_COOKIE_NAME
} from '../../auth/middleware/device';
import { ssoDomainNotAllowedHtml } from '../pages/domain-not-allowed';
import { errorHtml } from '../pages/error';

export let jxnApp = createHono()
  .post('/saml/callback', async c => {
    let form = await c.req.formData();

    let RelayState = form.get('RelayState') || '';
    let SAMLResponse = form.get('SAMLResponse') || '';

    let res = await jackson.oauthController.samlResponse({
      RelayState: RelayState as string,
      SAMLResponse: SAMLResponse as string
    });
    if (res.error) {
      return c.html(
        errorHtml({
          title: 'Authentication Error',
          message: 'Metorial could not authenticate you.',
          details: res.error
        })
      );
    }

    if (!res.redirect_url) {
      return c.html(
        errorHtml({
          title: 'Authentication Error',
          message: 'Provider did not return a redirect URL.'
        })
      );
    }

    return c.redirect(res.redirect_url);
  })
  .get('/saml/callback', async c => {
    try {
      let code = c.req.query('code');
      let tenantId = c.req.query('tenant_id');
      let connectionId = c.req.query('connection_id');
      if (!code || (!!tenantId !== !!connectionId)) {
        return c.html(
          errorHtml({
            title: 'Authentication Error',
            message: 'Invalid IdP-initiated SAML response.'
          })
        );
      }

      let connections = await db.ssoConnection.findMany({
        where: {
          id: connectionId,
          tenant: tenantId ? { id: tenantId, status: 'completed' } : { status: 'completed' },
          providerType: 'saml',
          status: 'active',
          importedDelegationOid: null
        },
        include: {
          tenant: {
            include: { app: true }
          }
        }
      });
      if (connections.length === 0) {
        return c.html(
          errorHtml({
            title: 'Authentication Error',
            message: 'SSO connection is not available.'
          })
        );
      }

      let authenticated:
        | {
            connection: (typeof connections)[number];
            accessToken: string;
          }
        | undefined;
      for (let connection of connections) {
        if (!connection.internalClientId || !connection.internalClientSecret) continue;
        try {
          let tokenRes = await jackson.oauthController.token({
            grant_type: 'authorization_code',
            code,
            redirect_uri:
              tenantId && connectionId
                ? getSamlConnectionDefaultRedirectUrl({
                    callbackUrl: jackson.defaultRedirectUrl.saml,
                    tenantId,
                    connectionId
                  })
                : jackson.defaultRedirectUrl.saml,
            client_id: connection.internalClientId,
            client_secret: connection.internalClientSecret
          });
          if (tokenRes.access_token) {
            authenticated = { connection, accessToken: tokenRes.access_token };
            break;
          }
        } catch {
          // A Jackson code is scoped to one connection. Failed exchanges are expected
          // while resolving legacy callbacks that predate tenant-bound redirects.
        }
      }
      if (!authenticated) {
        return c.html(
          errorHtml({
            title: 'Authentication Error',
            message: 'Metorial could not verify your SAML response.'
          })
        );
      }

      let { connection, accessToken } = authenticated;
      let userInfo = await jackson.oauthController.userInfo(accessToken);

      await ssoDomainPolicyService.assertEmailAllowed({
        tenant: connection.tenant,
        connection,
        email: userInfo.email,
        context: getRequestContext(c)
      });

      let user = await ssoIdentityService.upsertUser({
        tenant: connection.tenant,
        email: userInfo.email,
        firstName: userInfo.firstName,
        lastName: userInfo.lastName
      });
      let userProfile = await ssoIdentityService.upsertUserProfile({
        tenant: connection.tenant,
        connection,
        user,
        data: {
          email: userInfo.email,
          uid: userInfo.id,
          uidHash: userInfo.idHash,
          sub: userInfo.sub,
          firstName: userInfo.firstName,
          lastName: userInfo.lastName,
          roles: userInfo.roles ?? [],
          groups: userInfo.groups ?? [],
          raw: userInfo.raw
        }
      });

      let cookieHeader = c.req.header('cookie') ?? '';
      let deviceToken = Cookies.parse(cookieHeader)[DEVICE_TOKEN_COOKIE_NAME];
      let deviceInfo = deviceToken ? parseDeviceToken(deviceToken) : null;
      let ip = (c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? '')
        .split(',')[0]!
        .trim();
      let ua = c.req.header('user-agent') ?? '';
      let device = await deviceService.ensureDevice({
        deviceId: deviceInfo?.deviceId,
        deviceClientSecret: deviceInfo?.deviceClientSecret,
        context: { ip, ua }
      });

      let { authAttempt, session } = await ssoLoginService.completeLogin({
        tenant: connection.tenant,
        connection,
        userProfile,
        app: connection.tenant.app,
        device,
        context: { ip, ua },
        redirectUrl: connection.tenant.app.defaultRedirectUrl
      });

      let redirectUrl = new URL(authAttempt.redirectUrl);
      redirectUrl.searchParams.set('code', session.authorizationCode);

      let res = c.redirect(redirectUrl.toString());
      res.headers.append(
        'Set-Cookie',
        Cookies.serialize(
          DEVICE_TOKEN_COOKIE_NAME,
          `${device.id}:${device.clientSecret}`,
          baseCookieOpts
        )
      );
      res.headers.append(
        'Set-Cookie',
        Cookies.serialize(SESSION_ID_COOKIE_NAME, session.id, baseCookieOpts)
      );
      return res;
    } catch (error) {
      if (error instanceof SsoDomainNotAllowedError) {
        return c.html(ssoDomainNotAllowedHtml(error), 403);
      }

      return c.html(
        errorHtml({
          title: 'Authentication Error',
          message: 'Metorial could not authenticate you.'
        })
      );
    }
  })
  .get('/oidc/callback', async c => {
    let code = c.req.query('code') || '';
    let state = c.req.query('state') || '';

    let res = await jackson.oauthController.oidcAuthzResponse({
      code: code,
      state: state
    });
    if (res.error) {
      return c.html(
        errorHtml({
          title: 'Authentication Error',
          message: 'Metorial could not authenticate you.',
          details: res.error
        })
      );
    }

    if (!res.redirect_url) {
      return c.html(
        errorHtml({
          title: 'Authentication Error',
          message: 'Provider did not return a redirect URL.'
        })
      );
    }

    return c.redirect(res.redirect_url);
  });
