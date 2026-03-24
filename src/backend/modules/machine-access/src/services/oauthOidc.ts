import { Service } from '@lowerdeck/service';
import { getConfig } from '@metorial/config';
import { oauthJwkGlobalRepository } from '@metorial/multi-region';
import { createPrivateKey, sign } from 'node:crypto';
import { coreScopes } from '../../../access/src/definitions';
import { combineOAuthAndOidcScopes, hasOidcScope, oidcScopes } from '../lib/oidc';
import type { OAuthTokenWithAuthorization } from './machineAccessAuth';
import type {
  OAuthAuthorizationRequestWithRelations,
  OAuthAuthorizationWithRelations
} from './oauthAuthorization';
import { oauthJwkService } from './oauthJwk';

let encodeBase64Url = (value: string | Uint8Array) =>
  Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

type OidcClaimsAuthorization = Pick<
  OAuthAuthorizationWithRelations,
  'id' | 'scopes' | 'oidcScopes' | 'createdAt'
> & {
  oauthApplication?: { clientId: string } | null;
  user?: { id: string; name: string | null; email: string | null } | null;
  machineAccess: {
    actor?: { id: string; name: string | null } | null;
  };
};

let getSubject = (oauthAuthorization: OidcClaimsAuthorization) =>
  oauthAuthorization.user?.id ??
  oauthAuthorization.machineAccess.actor?.id ??
  oauthAuthorization.id;

let getDisplayName = (oauthAuthorization: OidcClaimsAuthorization) =>
  oauthAuthorization.user?.name ?? oauthAuthorization.machineAccess.actor?.name ?? null;

class OAuthOidcService {
  private async getActiveSigningKey() {
    let keys = await oauthJwkGlobalRepository.listOAuthJwks();
    let active = keys.find(key => key.status == 'active');

    if (active) return active;

    await oauthJwkService.rotateOAuthJwks();

    keys = await oauthJwkGlobalRepository.listOAuthJwks();
    active = keys.find(key => key.status == 'active');
    if (!active) {
      throw new Error('No active OIDC signing key is available');
    }

    return active;
  }

  async getOpenIdConfiguration() {
    let issuer = getConfig().urls.apiUrl;

    return {
      issuer,
      authorization_endpoint: `${issuer}/oauth/authorize`,
      token_endpoint: `${issuer}/oauth/token`,
      jwks_uri: `${issuer}/oauth/jwks`,
      userinfo_endpoint: `${issuer}/oauth/userinfo`,
      device_authorization_endpoint: `${issuer}/oauth/device_authorization`,
      response_types_supported: ['code'],
      grant_types_supported: [
        'authorization_code',
        'refresh_token',
        'client_credentials',
        'urn:ietf:params:oauth:grant-type:device_code'
      ],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['ES256'],
      scopes_supported: [...oidcScopes, ...coreScopes],
      claims_supported: [
        'sub',
        'iss',
        'aud',
        'exp',
        'iat',
        'auth_time',
        'nonce',
        'name',
        'preferred_username',
        'email',
        'email_verified'
      ],
      token_endpoint_auth_methods_supported: [
        'client_secret_basic',
        'client_secret_post',
        'none'
      ],
      code_challenge_methods_supported: ['S256']
    };
  }

  async getOAuthAuthorizationServerMetadata() {
    return await this.getOpenIdConfiguration();
  }

  async getPublicJwks() {
    let keys = await oauthJwkGlobalRepository.getPublicOAuthJwks();

    return {
      keys: keys.map(key => key.publicJwk as JsonWebKey)
    };
  }

  buildUserInfoClaims(oauthAuthorization: OidcClaimsAuthorization) {
    let claims: Record<string, unknown> = {
      sub: getSubject(oauthAuthorization)
    };

    console.log(oauthAuthorization.oidcScopes);

    if (hasOidcScope(oauthAuthorization.oidcScopes, 'profile')) {
      claims.name = getDisplayName(oauthAuthorization);
      claims.preferred_username =
        oauthAuthorization.user?.email ??
        oauthAuthorization.user?.id ??
        oauthAuthorization.machineAccess.actor?.id ??
        oauthAuthorization.id;
    }

    if (
      hasOidcScope(oauthAuthorization.oidcScopes, 'email') &&
      oauthAuthorization.user?.email
    ) {
      claims.email = oauthAuthorization.user.email;
      claims.email_verified = true;
    }

    return claims;
  }

  async createIdToken(d: {
    oauthToken: OAuthTokenWithAuthorization;
    oauthAuthorizationRequest: OAuthAuthorizationRequestWithRelations;
  }) {
    if (!hasOidcScope(d.oauthToken.oauthAuthorization.oidcScopes, 'openid')) return null;

    let signingKey = await this.getActiveSigningKey();
    let header = {
      alg: 'ES256',
      typ: 'JWT',
      kid: signingKey.kid
    };

    let payload: Record<string, unknown> = {
      iss: getConfig().urls.apiUrl,
      sub: getSubject(d.oauthToken.oauthAuthorization),
      aud: d.oauthToken.oauthAuthorization.oauthApplication?.clientId,
      iat: Math.floor(d.oauthToken.createdAt.getTime() / 1000),
      exp: Math.floor(d.oauthToken.accessTokenExpiresAt.getTime() / 1000),
      auth_time: Math.floor(
        (
          d.oauthAuthorizationRequest.oauthAuthorizationFlow?.acceptedAt ??
          d.oauthToken.oauthAuthorization.createdAt
        ).getTime() / 1000
      )
    };

    if (d.oauthAuthorizationRequest.nonce) {
      payload.nonce = d.oauthAuthorizationRequest.nonce;
    }

    Object.assign(payload, this.buildUserInfoClaims(d.oauthToken.oauthAuthorization));

    let encodedHeader = encodeBase64Url(JSON.stringify(header));
    let encodedPayload = encodeBase64Url(JSON.stringify(payload));
    let signingInput = `${encodedHeader}.${encodedPayload}`;
    let signature = sign('sha256', Buffer.from(signingInput), {
      key: createPrivateKey({
        key: signingKey.privateJwk as JsonWebKey,
        format: 'jwk'
      }),
      dsaEncoding: 'ieee-p1363'
    });

    return `${signingInput}.${encodeBase64Url(signature)}`;
  }

  getGrantedScopes(
    oauthAuthorization: Pick<OAuthAuthorizationWithRelations, 'scopes' | 'oidcScopes'>
  ) {
    return combineOAuthAndOidcScopes({
      accessScopes: oauthAuthorization.scopes,
      oidcScopes: oauthAuthorization.oidcScopes
    });
  }
}

export let oauthOidcService = Service.create(
  'oauthOidcService',
  () => new OAuthOidcService()
).build();
