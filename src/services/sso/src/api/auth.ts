import { badRequestError, ServiceError } from '@metorial/error';
import { createHono, useValidatedQuery } from '@metorial/hono';
import { v } from '@metorial/validation';
import { createHash, randomBytes } from 'crypto';
import { Connection, User, UserProfile } from '../db/schema';
import { env } from '../env';
import { jackson } from '../lib/jackson';
import { authSelectConnectionHtml } from '../pages/auth-select-connection';
import { errorHtml } from '../pages/error';
import { authService } from '../services/auth';

function generateCodeVerifier(): string {
  return randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

export let authApi = createHono()
  .get('/', async c => {
    try {
      let body = await useValidatedQuery(
        c,
        v.object({
          client_secret: v.string()
        })
      );

      let { auth, tenant } = await authService.getAuthByClientSecret({
        clientSecret: body.client_secret
      });

      let finalRedirectUri = new URL(auth.redirectUri);
      finalRedirectUri.searchParams.set('tenant_id', tenant._id.toString());
      finalRedirectUri.searchParams.set('auth_id', auth._id.toString());

      if (auth.status == 'completed') {
        return c.redirect(finalRedirectUri.toString());
      }

      let connections = await Connection.find({
        tenantId: tenant._id
      });
      if (connections.length == 0) {
        throw new ServiceError(
          badRequestError({
            message: 'No connections found for tenant.'
          })
        );
      }

      if (auth.email && connections.length > 1) {
        let user = await User.findOne({
          tenantId: tenant._id,
          email: auth.email
        });

        if (user) {
          let profiles = await UserProfile.find({
            userId: user._id,
            tenantId: tenant._id
          });

          let connectionIds = profiles.map(p => p.connectionId);
          connections = connections.filter(conn =>
            connectionIds.includes(conn._id.toString())
          );
        }
      }

      let connection: Connection | null = null;
      let connectionId = c.req.query('connection_id');

      if (connections.length == 1) {
        connection = connections[0];
      } else if (connectionId) {
        connection = connections.find(c => c._id.toString() === connectionId) || null;
      }

      if (!connection) {
        return c.html(
          authSelectConnectionHtml({
            tenant,
            connections,
            clientSecret: body.client_secret,
            currentUrl: c.req.url
          })
        );
      }

      let codeVerifier = generateCodeVerifier();
      let codeChallenge = generateCodeChallenge(codeVerifier);

      auth.codeVerifier = codeVerifier;
      auth.connectionId = connection._id;
      await auth.save();

      let res = await jackson.oauthController.authorize({
        state: auth.clientSecret,
        redirect_uri: `${env.saml.SSO_SERVICE_HOST}/sso/auth/callback`,
        client_id: connection.internalClientId,
        response_type: 'code',
        code_challenge: codeChallenge,
        code_challenge_method: 'S256'
      });
      if (res.error) {
        throw new ServiceError(
          badRequestError({
            message: 'Authorization failed: ' + res.error
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

      let { auth } = await authService.getAuthByClientSecret({
        clientSecret: body.state
      });
      if (auth.status === 'completed') {
        return c.redirect(auth.redirectUri);
      }

      let connection = await Connection.findById(auth.connectionId);
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
        redirect_uri: `${env.saml.SSO_SERVICE_HOST}/sso/auth/callback`,
        client_id: connection.internalClientId,
        client_secret: connection.internalClientSecret,

        // @ts-ignore
        code_verifier: auth.codeVerifier
      });

      let userInfo = await jackson.oauthController.userInfo(tokenRes.access_token);

      // Upsert user
      let user = await User.findOneAndUpdate(
        {
          tenantId: auth.tenantId,
          email: userInfo.email
        },
        {
          $set: {
            email: userInfo.email,
            firstName: userInfo.firstName,
            lastName: userInfo.lastName
          }
        },
        {
          upsert: true,
          new: true
        }
      );

      let profile = await UserProfile.findOneAndUpdate(
        {
          tenantId: auth.tenantId,
          userId: user._id,
          connectionId: connection._id,
          uidHash: userInfo.idHash
        },
        {
          $set: {
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
        },
        {
          upsert: true,
          new: true
        }
      );

      auth.connectionId = connection._id;
      auth.userId = user._id;
      auth.userProfileId = profile._id;
      auth.status = 'completed';
      await auth.save();

      let finalRedirectUri = new URL(auth.redirectUri);
      finalRedirectUri.searchParams.set('tenant_id', connection.tenantId);
      finalRedirectUri.searchParams.set('auth_id', auth._id.toString());

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
