import { badRequestError, ServiceError } from '@lowerdeck/error';
import { createHono, useValidatedQuery } from '@lowerdeck/hono';
import { v } from '@lowerdeck/validation';
import { createHash, randomBytes } from 'crypto';
import { db } from '../../../db';
import { env } from '../../../env';
import { jackson } from '../../../lib/jackson';
import { ssoService } from '../../../services/sso';
import { authSelectConnectionHtml } from '../pages/auth-select-connection';
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

      let auth = await ssoService.getAuthByClientSecret({
        clientSecret: body.client_secret
      });

      let finalRedirectUri = new URL(auth.redirectUri);
      finalRedirectUri.searchParams.set('tenant_id', auth.tenant.id);
      finalRedirectUri.searchParams.set('auth_id', auth.id);

      if (auth.status == 'completed') {
        return c.redirect(finalRedirectUri.toString());
      }

      let connections = await ssoService.getConnectionsByTenant({
        tenant: auth.tenant
      });
      if (connections.length == 0) {
        throw new ServiceError(
          badRequestError({
            message: 'No connections found for tenant.'
          })
        );
      }

      if (auth.email && connections.length > 1) {
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

      let connection: (typeof connections)[number] | null = null;
      let connectionId = c.req.query('connection_id');

      if (connections.length == 1) {
        connection = connections[0]!;
      } else if (connectionId) {
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

      let auth = await ssoService.getAuthByClientSecret({
        clientSecret: body.state
      });
      if (auth.status === 'completed') {
        return c.redirect(auth.redirectUri);
      }

      let connection = await db.ssoConnection.findUnique({
        where: { oid: auth.connectionOid! }
      });
      if (!connection) {
        throw new ServiceError(
          badRequestError({
            message: 'Connection not found for auth.'
          })
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

      let user = await ssoService.upsertUser({
        tenant: auth.tenant,
        email: userInfo.email,
        firstName: userInfo.firstName,
        lastName: userInfo.lastName
      });

      let profile = await ssoService.upsertUserProfile({
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

      let finalRedirectUri = new URL(auth.redirectUri);
      finalRedirectUri.searchParams.set('tenant_id', auth.tenant.id);
      finalRedirectUri.searchParams.set('auth_id', auth.id);

      return c.redirect(finalRedirectUri.toString());
    } catch (error: any) {
      return c.html(
        errorHtml({
          title: 'Unable to Authenticate',
          message: 'An error occurred during authentication.',
          details: error.message
        })
      );
    }
  });
