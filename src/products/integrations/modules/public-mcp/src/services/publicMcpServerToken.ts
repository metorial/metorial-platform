import { Service } from '@lowerdeck/service';
import {
  db,
  getId,
  type PublicMcpServer,
  type PublicMcpServerGrant,
  withTransaction
} from '@metorial-subspace/db';
import {
  generatePublicMcpToken,
  getPublicMcpTokenType,
  PUBLIC_MCP_ACCESS_TOKEN_PREFIX
} from '@metorial/api-keys';
import { createCodeChallenge } from '@metorial/consumer-oauth-utils';
import { addSeconds } from 'date-fns';
import { randomUUID } from 'node:crypto';
import { assertPublicMcpRateLimit } from '../internal/rateLimit';
import { PUBLIC_MCP_RATE_LIMITS, PUBLIC_MCP_SCOPE } from '../lib/constants';
import { PublicMcpOAuthError } from '../lib/oauthError';
import { hashSecret, secretsEqual } from '../lib/secrets';
import type { PublicMcpRoute } from './publicMcpRoute';
import { publicMcpServerClientService } from './publicMcpServerClient';
import { publicMcpServerGrantService } from './publicMcpServerGrant';

let codeVerifierPattern = /^[A-Za-z0-9\-._~]{43,128}$/;

let normalizeResource = (value: string) => value.replace(/\/+$/, '');

let invalidGrant = (description: string) =>
  new PublicMcpOAuthError('invalid_grant', description);

export type PublicMcpTokenRequest = {
  grantType: string | null;
  code: string | null;
  redirectUri: string | null;
  codeVerifier: string | null;
  refreshToken: string | null;
  resource: string | null;
};

export type PublicMcpClientCredentials = {
  clientId: string | null;
  clientSecret: string | null;
  method: 'client_secret_basic' | 'client_secret_post' | 'none';
};

class publicMcpServerTokenServiceImpl {
  async exchange(d: {
    route: PublicMcpRoute;
    validBaseUrls: string[];
    input: PublicMcpTokenRequest;
    credentials: PublicMcpClientCredentials;
    context: { ip: string; ua: string | null };
  }) {
    await assertPublicMcpRateLimit({
      key: `token:ip:${d.context.ip}`,
      limit: PUBLIC_MCP_RATE_LIMITS.tokenPerIp
    });

    let client = await publicMcpServerClientService.authenticateClient({
      publicMcpServer: d.route,
      ...d.credentials
    });

    if (d.input.resource && !d.validBaseUrls.includes(normalizeResource(d.input.resource))) {
      throw new PublicMcpOAuthError(
        'invalid_target',
        'resource does not identify this server'
      );
    }

    if (d.route.status !== 'active') {
      throw new PublicMcpOAuthError(
        'temporarily_unavailable',
        'This server is currently unavailable',
        { status: 503 }
      );
    }

    if (d.input.grantType === 'authorization_code') {
      let issued = await this.exchangeCode({
        route: d.route,
        clientOid: client.oid,
        input: d.input
      });
      return issued.response;
    }

    if (d.input.grantType === 'refresh_token') {
      let issued = await this.exchangeRefreshToken({
        route: d.route,
        clientOid: client.oid,
        input: d.input
      });
      return issued.response;
    }

    throw new PublicMcpOAuthError(
      'unsupported_grant_type',
      'Only authorization_code and refresh_token are supported'
    );
  }

  private async exchangeCode(d: {
    route: PublicMcpRoute;
    clientOid: bigint;
    input: PublicMcpTokenRequest;
  }) {
    if (!d.input.code) throw new PublicMcpOAuthError('invalid_request', 'code is required');
    if (!d.input.codeVerifier || !codeVerifierPattern.test(d.input.codeVerifier)) {
      throw new PublicMcpOAuthError('invalid_request', 'A valid code_verifier is required');
    }

    let authorization = await db.publicMcpServerAuthorization.findUnique({
      where: { authorizationCodeHash: await hashSecret(d.input.code) },
      include: { grant: true }
    });

    if (
      !authorization ||
      authorization.publicMcpServerOid !== d.route.oid ||
      authorization.clientOid !== d.clientOid
    ) {
      throw invalidGrant('Invalid authorization code');
    }

    if (authorization.status === 'exchanged' || authorization.codeUsedAt) {
      // RFC 6749 4.1.2: a replayed code revokes everything issued from it.
      if (authorization.grant) {
        await publicMcpServerGrantService.revokeGrantInternal({
          grant: authorization.grant,
          reason: 'authorization_code_reuse'
        });
      }
      throw invalidGrant('Authorization code has already been used');
    }

    if (
      authorization.status !== 'code_issued' ||
      !authorization.codeExpiresAt ||
      authorization.codeExpiresAt <= new Date() ||
      !authorization.grant
    ) {
      throw invalidGrant('Authorization code has expired');
    }

    if (d.input.redirectUri !== authorization.redirectUri) {
      throw invalidGrant('redirect_uri does not match the authorization request');
    }

    let challenge = await createCodeChallenge(d.input.codeVerifier);
    if (!secretsEqual(challenge, authorization.codeChallenge)) {
      throw invalidGrant('PKCE verification failed');
    }

    let grant = authorization.grant;
    let now = new Date();

    return await withTransaction(async db => {
      let claimed = await db.publicMcpServerAuthorization.updateMany({
        where: { oid: authorization.oid, status: 'code_issued', codeUsedAt: null },
        data: { status: 'exchanged', codeUsedAt: now }
      });
      if (claimed.count !== 1) throw invalidGrant('Authorization code has already been used');

      let activated = await db.publicMcpServerGrant.updateMany({
        where: { oid: grant.oid, status: 'pending_exchange' },
        data: {
          status: 'active',
          lastUsedAt: now,
          expiresAt: addSeconds(now, d.route.grantIdleExpirySeconds)
        }
      });
      if (activated.count !== 1) throw invalidGrant('Authorization code has expired');

      return await this.issueTokens({ route: d.route, grant, familyId: randomUUID() });
    });
  }

  private async exchangeRefreshToken(d: {
    route: PublicMcpRoute;
    clientOid: bigint;
    input: PublicMcpTokenRequest;
  }) {
    if (!d.input.refreshToken || getPublicMcpTokenType(d.input.refreshToken) !== 'refresh') {
      throw invalidGrant('Invalid refresh token');
    }

    let token = await db.publicMcpServerToken.findUnique({
      where: { tokenHash: await hashSecret(d.input.refreshToken) },
      include: { grant: true }
    });

    if (
      !token ||
      token.type !== 'refresh' ||
      token.grant.publicMcpServerOid !== d.route.oid ||
      token.grant.clientOid !== d.clientOid
    ) {
      throw invalidGrant('Invalid refresh token');
    }

    let reuseDetected = async () => {
      await publicMcpServerGrantService.revokeGrantInternal({
        grant: token.grant,
        reason: 'refresh_token_reuse'
      });
      return invalidGrant('Refresh token has already been used');
    };

    if (token.usedAt || token.revokedAt) {
      if (token.grant.status === 'active') throw await reuseDetected();
      throw invalidGrant('Refresh token has been revoked');
    }

    let now = new Date();
    if (
      token.expiresAt <= now ||
      token.grant.status !== 'active' ||
      token.grant.expiresAt <= now
    ) {
      throw invalidGrant('Refresh token has expired');
    }

    let result = await withTransaction(async db => {
      let claimed = await db.publicMcpServerToken.updateMany({
        where: { oid: token.oid, usedAt: null, revokedAt: null },
        data: { usedAt: now }
      });
      if (claimed.count !== 1) return null;

      await db.publicMcpServerGrant.updateMany({
        where: { oid: token.grantOid, status: 'active' },
        data: {
          lastUsedAt: now,
          expiresAt: addSeconds(now, d.route.grantIdleExpirySeconds)
        }
      });

      let issued = await this.issueTokens({
        route: d.route,
        grant: token.grant,
        familyId: token.familyId
      });

      await db.publicMcpServerToken.update({
        where: { oid: token.oid },
        data: { replacedByOid: issued.refreshTokenOid }
      });

      return issued;
    });

    if (!result) throw await reuseDetected();

    return result;
  }

  private async issueTokens(d: {
    route: PublicMcpServer;
    grant: PublicMcpServerGrant;
    familyId: string;
  }) {
    let now = new Date();
    let accessToken = generatePublicMcpToken('access');
    let refreshToken = generatePublicMcpToken('refresh');

    return await withTransaction(async db => {
      await db.publicMcpServerToken.create({
        data: {
          ...getId('publicMcpServerToken'),
          type: 'access',
          tokenHash: await hashSecret(accessToken),
          familyId: d.familyId,
          grantOid: d.grant.oid,
          projectOid: d.grant.projectOid,
          instanceOid: d.grant.instanceOid,
          expiresAt: addSeconds(now, d.route.accessTokenTtlSeconds)
        }
      });

      let refresh = await db.publicMcpServerToken.create({
        data: {
          ...getId('publicMcpServerToken'),
          type: 'refresh',
          tokenHash: await hashSecret(refreshToken),
          familyId: d.familyId,
          grantOid: d.grant.oid,
          projectOid: d.grant.projectOid,
          instanceOid: d.grant.instanceOid,
          expiresAt: addSeconds(now, d.route.refreshTokenTtlSeconds)
        }
      });

      return {
        refreshTokenOid: refresh.oid,
        response: {
          access_token: accessToken,
          token_type: 'Bearer' as const,
          expires_in: d.route.accessTokenTtlSeconds,
          refresh_token: refreshToken,
          scope: PUBLIC_MCP_SCOPE
        }
      };
    });
  }

  async revoke(d: {
    route: PublicMcpRoute;
    token: string | null;
    credentials: PublicMcpClientCredentials;
    context: { ip: string; ua: string | null };
  }) {
    await assertPublicMcpRateLimit({
      key: `token:ip:${d.context.ip}`,
      limit: PUBLIC_MCP_RATE_LIMITS.tokenPerIp
    });

    let client = await publicMcpServerClientService.authenticateClient({
      publicMcpServer: d.route,
      ...d.credentials
    });

    // RFC 7009: unknown or foreign tokens are not an error.
    if (!d.token || !getPublicMcpTokenType(d.token)) return;

    let token = await db.publicMcpServerToken.findUnique({
      where: { tokenHash: await hashSecret(d.token) },
      include: { grant: true }
    });
    if (
      !token ||
      token.grant.publicMcpServerOid !== d.route.oid ||
      token.grant.clientOid !== client.oid
    ) {
      return;
    }

    if (token.type === 'refresh') {
      if (token.grant.status === 'active' || token.grant.status === 'pending_exchange') {
        await publicMcpServerGrantService.revokeGrantInternal({
          grant: token.grant,
          reason: 'user_revoked'
        });
      }
      return;
    }

    await db.publicMcpServerToken.updateMany({
      where: { oid: token.oid, revokedAt: null },
      data: { revokedAt: new Date() }
    });
  }

  async authenticateAccessToken(d: { route: PublicMcpRoute; token: string | null }) {
    let invalidToken = (description: string) =>
      new PublicMcpOAuthError('invalid_token', description);

    if (!d.token || !d.token.startsWith(PUBLIC_MCP_ACCESS_TOKEN_PREFIX)) {
      throw invalidToken('A valid access token is required');
    }

    let token = await db.publicMcpServerToken.findUnique({
      where: { tokenHash: await hashSecret(d.token) },
      include: { grant: { include: { client: true } } }
    });

    let now = new Date();
    if (
      !token ||
      token.type !== 'access' ||
      token.revokedAt ||
      token.expiresAt <= now ||
      token.grant.status !== 'active' ||
      token.grant.expiresAt <= now ||
      token.grant.publicMcpServerOid !== d.route.oid ||
      token.grant.instanceOid !== d.route.instanceOid
    ) {
      throw invalidToken('The access token is invalid or has expired');
    }

    if (d.route.status !== 'active') {
      throw invalidToken('This server is currently unavailable');
    }

    return token.grant;
  }
}

export let publicMcpServerTokenService = Service.create(
  'publicMcpServerToken',
  () => new publicMcpServerTokenServiceImpl()
).build();
