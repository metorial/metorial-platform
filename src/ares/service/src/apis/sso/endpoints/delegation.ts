import { createHono, useValidatedQuery } from '@lowerdeck/hono';
import { v } from '@lowerdeck/validation';
import { db } from '../../../db';
import { env } from '../../../env';
import { getId } from '../../../id';
import { validateDelegationRedirectUri } from '../../../lib/ssoDelegationProtocol';
import { ssoAuthService } from '../../../services/sso/auth';
import { ssoDelegationService } from '../../../services/sso/delegation';

let parseBasicCredentials = (authorization?: string) => {
  if (!authorization?.startsWith('Basic ')) return null;
  try {
    let decoded = Buffer.from(authorization.slice(6), 'base64').toString();
    let separator = decoded.indexOf(':');
    if (separator < 0) return null;
    return {
      clientId: decoded.slice(0, separator),
      clientSecret: decoded.slice(separator + 1)
    };
  } catch {
    return null;
  }
};

export let ssoDelegationApp = createHono()
  .get('/authorize', async c => {
    let input = await useValidatedQuery(
      c,
      v.object({
        client_id: v.string(),
        response_type: v.literal(
          'urn:metorial.com:ares:sso-delegation'
        ),
        redirect_uri: v.string(),
        state: v.string(),
        code_challenge: v.string(),
        code_challenge_method: v.literal('S256'),
        connection_id: v.optional(v.string()),
        login_hint: v.optional(v.string())
      })
    );
    let delegation = await ssoDelegationService.getExportByClientId({
      clientId: input.client_id
    });
    if (
      input.state.length > 512 ||
      input.code_challenge.length > 128 ||
      (input.login_hint?.length ?? 0) > 320
    ) {
      return c.json({ error: 'invalid_request' }, 400);
    }
    let redirectUri = validateDelegationRedirectUri({
      redirectUri: input.redirect_uri,
      allowHttpLocalhost:
        process.env.NODE_ENV === 'development' ||
        process.env.METORIAL_ENV === 'development'
    });
    let connection = input.connection_id
      ? await db.ssoConnection.findFirst({
          where: {
            tenantOid: delegation.tenantOid,
            id: input.connection_id,
            status: 'active'
          }
        })
      : null;
    if (input.connection_id && !connection) {
      return c.json({ error: 'invalid_connection' }, 400);
    }

    let auth = await ssoAuthService.createAuth({
      tenant: delegation.tenant,
      account: delegation.tenant.account,
      connection: connection ?? undefined,
      input: {
        redirectUri: `${env.service.ARES_SSO_URL}/metorial-ares/sso-delegation/complete`,
        state: crypto.randomUUID(),
        email: input.login_hint
      }
    });
    await db.ssoDelegationAuthRequest.create({
      data: {
        ...getId('ssoDelegationAuthRequest'),
        exportedDelegationOid: delegation.oid,
        ssoAuthOid: auth.oid,
        redirectUri,
        state: input.state,
        codeChallenge: input.code_challenge,
        codeChallengeMethod: input.code_challenge_method,
        sourceConnectionId: input.connection_id,
        expiresAt: new Date(Date.now() + 10 * 60_000)
      }
    });
    return c.redirect(
      `${env.service.ARES_SSO_URL}/sso/auth?client_secret=${encodeURIComponent(auth.clientSecret)}`
    );
  })
  .get('/complete', async c => {
    let input = await useValidatedQuery(
      c,
      v.object({
        tenant_id: v.string(),
        auth_id: v.string()
      })
    );
    let result = await ssoDelegationService.completeExportAuthorization({
      tenantId: input.tenant_id,
      authId: input.auth_id
    });
    let redirect = new URL(result.redirectUri);
    redirect.searchParams.set('code', result.code);
    redirect.searchParams.set('state', result.state);
    return c.redirect(redirect.toString());
  })
  .post('/token', async c => {
    let credentials = parseBasicCredentials(c.req.header('authorization'));
    if (!credentials) {
      return c.json({ error: 'invalid_client' }, 401);
    }

    let delegation;
    try {
      delegation = await ssoDelegationService.authenticateExport(credentials);
    } catch {
      return c.json({ error: 'invalid_client' }, 404);
    }

    let body = (await c.req.parseBody()) as Record<string, string>;
    if (body.token) {
      let result = await ssoDelegationService.introspectToken({
        delegation,
        token: body.token
      });
      return c.json(result);
    }

    if (
      body.grant_type === 'client_credentials' &&
      body.scope === 'urn:metorial.com:ares:sso-delegation:metadata'
    ) {
      let token = await ssoDelegationService.createToken({
        delegation,
        type: 'metadata'
      });
      return c.json({
        access_token: token,
        token_type: 'Bearer',
        expires_in: 300
      });
    }

    if (
      body.grant_type === 'authorization_code' &&
      body.code &&
      body.redirect_uri &&
      body.code_verifier
    ) {
      try {
        let token = await ssoDelegationService.exchangeAuthorizationCode({
          delegation,
          code: body.code,
          redirectUri: body.redirect_uri,
          codeVerifier: body.code_verifier
        });
        return c.json({
          access_token: token,
          token_type: 'Bearer',
          expires_in: 300
        });
      } catch {
        return c.json({ error: 'invalid_grant' }, 400);
      }
    }

    return c.json({ error: 'unsupported_grant_type' }, 400);
  });
