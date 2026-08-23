import { badRequestError, ServiceError } from '@lowerdeck/error';
import { createHono, useValidatedQuery } from '@lowerdeck/hono';
import { v } from '@lowerdeck/validation';
import { createHash, randomBytes } from 'crypto';
import { db } from '../../../db';
import { env } from '../../../env';
import { getRequestContext } from '../../../lib/context';
import { jackson } from '../../../lib/jackson';
import { ssoAuthService } from '../../../services/sso/auth';
import { getSsoAuthCompletionRedirect } from '../../../services/sso/authRedirect';
import { ssoConnectionService } from '../../../services/sso/connection';
import {
  SsoDomainNotAllowedError,
  ssoDomainPolicyService
} from '../../../services/sso/domainPolicy';
import { ssoIdentityService } from '../../../services/sso/identity';
import { authSelectConnectionHtml } from '../pages/auth-select-connection';
import { ssoDomainNotAllowedHtml } from '../pages/domain-not-allowed';
import { errorHtml } from '../pages/error';

function generateCodeVerifier(): string {
  return randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

export let ssoAuthApp = createHono()
  .get('/', async c => {
    try {
      let body = await useValidatedQuery(
        c,
        v.object({
          client_secret: v.string()
        })
      );

      let auth = await ssoAuthService.getAuthByClientSecret({
        clientSecret: body.client_secret
      });

      let finalRedirectUri = new URL(auth.redirectUri);
      finalRedirectUri.searchParams.set('tenant_id', auth.tenant.id);
      finalRedirectUri.searchParams.set('auth_id', auth.id);

      if (auth.status == 'completed') {
        return c.redirect(finalRedirectUri.toString());
      }

      let connections = await ssoConnectionService.getConnectionsByTenant({
        tenant: auth.tenant
      });
      if (connections.length == 0) {
        throw new ServiceError(
          badRequestError({
            message: 'No connections found for tenant.'
          })
        );
      }

      if (auth.email && !auth.connectionOid && connections.length > 1) {
        let user = await db.ssoUser.findFirst({
          where: { tenantOid: auth.tenant.oid, email: auth.email }
        });

        if (user) {
          let profiles = await db.ssoUserProfile.findMany({
            where: { userOid: user.oid, tenantOid: auth.tenant.oid }
          });

          let connectionOids = profiles.map(p => p.connectionOid);
          connections = connections.filter(conn => connectionOids.includes(conn.oid));
        }
      }

      let connection: (typeof connections)[number] | null =
        connections.find(connection => connection.oid == auth.connectionOid) ?? null;
      let connectionId = c.req.query('connection_id');

      if (!connection && connections.length == 1) {
        connection = connections[0]!;
      } else if (!connection && connectionId) {
        connection = connections.find(c => c.id === connectionId) || null;
      }

      if (!connection) {
        return c.html(
          authSelectConnectionHtml({
            tenant: auth.tenant,
            connections,
            clientSecret: body.client_secret,
            currentUrl: c.req.url
          })
        );
      }
      if (!connection.internalClientId || !connection.internalClientSecret) {
        throw new ServiceError(
          badRequestError({ message: 'Imported connections must use delegation auth.' })
        );
      }

      let codeVerifier = generateCodeVerifier();
      let codeChallenge = generateCodeChallenge(codeVerifier);

      await db.ssoAuth.update({
        where: { oid: auth.oid },
        data: {
          codeVerifier,
          connectionOid: connection.oid
        }
      });

      let res = await jackson.oauthController.authorize({
        state: auth.clientSecret,
        redirect_uri: `${env.service.ARES_SSO_URL}/sso/auth/callback`,
        client_id: connection.internalClientId,
        response_type: 'code',
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        login_hint: auth.email ?? undefined
      });
      if (res.error) {
        throw new ServiceError(
          badRequestError({
            message: 'Authorization failed: ' + res.error
          })
        );
      }

      if (!res.redirect_url) {
        throw new ServiceError(
          badRequestError({
            message: 'Authorization failed: No redirect URL provided by IdP'
          })
        );
      }

      return c.redirect(res.redirect_url!);
    } catch (error: any) {
      if (error instanceof SsoDomainNotAllowedError) {
        return c.html(ssoDomainNotAllowedHtml(error), 403);
      }

      return c.html(
        errorHtml({
          title: 'Unable to Authenticate',
          message: 'An error occurred during authentication.',
          details: error.message
        })
      );
    }
  })
  .get('/callback', async c => {
    try {
      let body = await useValidatedQuery(
        c,
        v.object({
          code: v.string(),
          state: v.string()
        })
      );

      let auth = await ssoAuthService.getAuthByClientSecret({
        clientSecret: body.state
      });
      if (auth.account && auth.account.status != 'active') {
        throw new ServiceError(badRequestError({ message: 'Account is not active.' }));
      }
      if (auth.status === 'completed') {
        return c.redirect(auth.redirectUri);
      }

      let connection = await db.ssoConnection.findUnique({
        where: { oid: auth.connectionOid! }
      });
      if (!connection || connection.status !== 'active') {
        throw new ServiceError(
          badRequestError({
            message: 'Connection not found or disabled for auth.'
          })
        );
      }
      if (!connection.internalClientId || !connection.internalClientSecret) {
        throw new ServiceError(
          badRequestError({ message: 'Imported connections must use delegation auth.' })
        );
      }

      let tokenRes = await jackson.oauthController.token({
        grant_type: 'authorization_code',
        code: body.code,
        redirect_uri: `${env.service.ARES_SSO_URL}/sso/auth/callback`,
        client_id: connection.internalClientId,
        client_secret: connection.internalClientSecret,
        // @ts-ignore
        code_verifier: auth.codeVerifier
      });

      let userInfo = await jackson.oauthController.userInfo(tokenRes.access_token);

      await ssoDomainPolicyService.assertEmailAllowed({
        tenant: auth.tenant,
        connection,
        account: auth.account,
        email: userInfo.email,
        context: getRequestContext(c)
      });

      if (auth.purpose === 'connection_test') {
        let testSso = await db.ssoTest.findUnique({ where: { authOid: auth.oid } });
        if (!testSso) {
          throw new ServiceError(badRequestError({ message: 'SSO test record not found.' }));
        }

        await db.ssoTest.update({
          where: { oid: testSso.oid },
          data: {
            status: 'completed',
            email: userInfo.email,
            firstName: userInfo.firstName,
            lastName: userInfo.lastName,
            uid: userInfo.id,
            sub: userInfo.sub ?? null,
            groups: userInfo.groups ?? [],
            roles: userInfo.roles ?? [],
            raw: userInfo.raw,
            completedAt: new Date()
          }
        });

        let testRedirect = getSsoAuthCompletionRedirect({
          redirectUri: auth.redirectUri,
          purpose: auth.purpose,
          tenantId: auth.tenant.id,
          authId: auth.id,
          testSsoId: testSso.id
        });

        // The auth was only ever a vehicle for the test, and `SsoTest.authId` keeps the audit trail.
        await db.ssoAuth.delete({ where: { oid: auth.oid } });
        return c.redirect(testRedirect.url);
      }

      let user = await ssoIdentityService.upsertUser({
        tenant: auth.tenant,
        email: userInfo.email,
        firstName: userInfo.firstName,
        lastName: userInfo.lastName
      });

      let profile = await ssoIdentityService.upsertUserProfile({
        tenant: auth.tenant,
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

      await db.ssoAuth.update({
        where: { oid: auth.oid },
        data: {
          connectionOid: connection.oid,
          userOid: user.oid,
          userProfileOid: profile.oid,
          status: 'completed'
        }
      });

      let completionRedirect = getSsoAuthCompletionRedirect({
        redirectUri: auth.redirectUri,
        purpose: auth.purpose,
        tenantId: auth.tenant.id,
        authId: auth.id
      });
      return c.redirect(completionRedirect.url);
    } catch (error: any) {
      if (error instanceof SsoDomainNotAllowedError) {
        return c.html(ssoDomainNotAllowedHtml(error), 403);
      }

      return c.html(
        errorHtml({
          title: 'Unable to Authenticate',
          message: 'An error occurred during authentication.',
          details: error.message
        })
      );
    }
  });
