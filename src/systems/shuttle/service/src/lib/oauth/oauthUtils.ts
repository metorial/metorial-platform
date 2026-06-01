import { canonicalize } from '@lowerdeck/canonicalize';
import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Hash } from '@lowerdeck/hash';
import { getSentry } from '@lowerdeck/sentry';
import axios from 'axios';
import { customAlphabet } from 'nanoid';
import type {
  RemoteOAuthConfig,
  RemoteOAuthConnection,
  Tenant
} from '../../../prisma/generated/client';
import { oauthCallbackUrl } from '../../config';
import { db } from '../../db';
import { getId } from '../../id';
import { getAxiosSsrfFilter } from '../http/axiosSsrf';
import { assertUrlAllowedByEgressPolicy } from '../network/egressPolicy';
import {
  type OAuthConfiguration,
  type RegistrationResponse,
  registrationResponseValidator,
  type TokenResponse,
  type UserProfile
} from './types';
import { normalizeAuthorizationUrl } from './normalizeAuthorizationUrl';

axios.defaults.headers.common['Accept-Encoding'] = 'gzip';

let id = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 21);

let Sentry = getSentry();

export class OAuthUtils {
  static generateState(): string {
    return id(32);
  }

  static generateCodeVerifier(): string {
    return id(128);
  }

  static async generateCodeChallenge(verifier: string): Promise<string> {
    let encoder = new TextEncoder();
    let data = encoder.encode(verifier);
    let digest = await crypto.subtle.digest('SHA-256', data);
    return this.base64UrlEncode(new Uint8Array(digest));
  }

  private static base64UrlEncode(buffer: Uint8Array): string {
    let base64 = btoa(String.fromCharCode(...buffer));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  static buildAuthorizationUrl({
    authEndpoint,
    clientId,
    redirectUri,
    scopes,
    state,
    codeChallenge
  }: {
    authEndpoint: string;
    clientId: string;
    redirectUri: string;
    scopes: string[];
    state?: string;
    codeChallenge?: string;
  }): string {
    let url = new URL(normalizeAuthorizationUrl(authEndpoint));

    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);

    if (scopes.length > 0) {
      url.searchParams.set('scope', scopes.join(' '));
    }

    if (state) {
      url.searchParams.set('state', state);
    }

    if (codeChallenge) {
      url.searchParams.set('code_challenge', codeChallenge);
      url.searchParams.set('code_challenge_method', 'S256');
    }

    return url.toString();
  }

  static async exchangeCodeForTokens({
    tokenEndpoint,
    clientId,
    clientSecret,
    code,
    redirectUri,
    codeVerifier,
    config,
    egressPolicy
  }: {
    tokenEndpoint: string;
    clientId: string;
    clientSecret?: string;
    code: string;
    redirectUri: string;
    codeVerifier?: string;
    config: OAuthConfiguration;
    egressPolicy?: PrismaJson.CompiledEgressNetworkAllowList | null;
  }): Promise<TokenResponse> {
    let body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri
    });

    // Always include client_id if public client
    if (!clientSecret) {
      body.set('client_id', clientId);
    }

    if (codeVerifier) {
      body.set('code_verifier', codeVerifier);
    }

    let headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      'User-Agent': 'Metorial (https://metorial.com)'
    };

    if (clientSecret) {
      if (config.token_endpoint_auth_methods_supported?.includes('client_secret_basic')) {
        headers.Authorization = `Basic ${btoa(`${clientId}:${clientSecret}`)}`;
      } else {
        body.set('client_id', clientId);
        body.set('client_secret', clientSecret);
      }
    }

    try {
      await assertUrlAllowedByEgressPolicy({ url: tokenEndpoint, egressPolicy });

      let response = await axios.post<TokenResponse>(tokenEndpoint, body.toString(), {
        headers,
        maxRedirects: 5,
        timeout: 5000,
        ...getAxiosSsrfFilter(tokenEndpoint)
      });

      // @ts-ignore
      if (response.data.ok === false)
        // @ts-ignore
        throw new Error(response.data.message ?? 'Unknown oauth error (provider ok=false)');

      return response.data;
    } catch (error: any) {
      Sentry.captureException(error, {
        extra: {
          tokenEndpoint,
          clientId,
          redirectUri
        }
      });

      let errorMessage = error.response?.data?.error_description || error.message;

      throw new ServiceError(
        badRequestError({
          message: `Token exchange failed: ${error.response?.status ?? 'unknown'} ${errorMessage}`
        })
      );
    }
  }

  static async refreshAccessToken({
    tokenEndpoint,
    clientId,
    clientSecret,
    refreshToken,
    config
  }: {
    tokenEndpoint: string;
    clientId: string;
    clientSecret?: string; // now optional
    refreshToken: string;
    config: OAuthConfiguration;
  }): Promise<{ ok: true; response: TokenResponse } | { ok: false; message: string }> {
    let body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    });

    // Always include client_id if no client_secret (public client)
    if (!clientSecret) {
      body.set('client_id', clientId);
    }

    let headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      'User-Agent': 'Metorial (https://metorial.com)'
    };

    if (clientSecret) {
      if (config.token_endpoint_auth_methods_supported?.includes('client_secret_basic')) {
        headers.Authorization = `Basic ${btoa(`${clientId}:${clientSecret}`)}`;
      } else {
        body.set('client_id', clientId);
        body.set('client_secret', clientSecret);
      }
    }

    try {
      let response = await axios.post<TokenResponse>(tokenEndpoint, body.toString(), {
        headers,
        maxRedirects: 5,
        timeout: 5000,
        ...getAxiosSsrfFilter(tokenEndpoint)
      });
      return {
        ok: true,
        response: response.data
      };
    } catch (error: any) {
      Sentry.captureException(error, {
        extra: { tokenEndpoint, clientId }
      });
      return {
        ok: false,
        message:
          error.response?.data?.error_description ||
          (error.response?.data ? JSON.stringify(error.response?.data) : error.message)
      };
    }
  }

  static async getUserProfile({
    userInfoEndpoint,
    accessToken,
    egressPolicy
  }: {
    userInfoEndpoint: string;
    accessToken: string;
    egressPolicy?: PrismaJson.CompiledEgressNetworkAllowList | null;
  }): Promise<UserProfile | null> {
    try {
      await assertUrlAllowedByEgressPolicy({ url: userInfoEndpoint, egressPolicy });

      let response = await axios.get(userInfoEndpoint, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
          'User-Agent': 'Metorial (https://metorial.com)'
        },
        maxRedirects: 5,
        timeout: 5000,
        ...getAxiosSsrfFilter(userInfoEndpoint)
      });

      let data = response.data;
      data.sub = data.sub ?? data.id ?? data.user_id;

      if (!data.sub) return null;

      return {
        raw: data,
        sub: String(data.sub),
        name: typeof data.name === 'string' ? data.name : undefined,
        email: typeof data.email === 'string' ? data.email : undefined
      };
    } catch (error: any) {
      Sentry.captureException(error, {
        extra: { userInfoEndpoint }
      });

      let errorMessage = error.response?.data?.error_description || error.message;
      throw new ServiceError(
        badRequestError({
          message: `Failed to fetch user profile: ${error.response?.status ?? 'unknown'} ${errorMessage}`
        })
      );
    }
  }

  static getProviderName(config: OAuthConfiguration): string {
    if (config.issuer) {
      try {
        let url = new URL(config.issuer);
        return url.hostname.split('.').slice(-2).join('.');
      } catch (e) {
        return config.issuer.replace(/https?:\/\//, '').replace(/\/$/, '');
      }
    }

    if (config.authorization_endpoint) {
      try {
        let url = new URL(config.authorization_endpoint);
        return url.hostname.split('.').slice(-2).join('.');
      } catch (e) {
        return 'OAuth Provider';
      }
    }

    return 'OAuth Provider';
  }

  static getProviderUrl(config: OAuthConfiguration): string {
    if (config.issuer) {
      try {
        let url = new URL(config.issuer);
        let host = url.hostname.split('.').slice(-2).join('.');
        return `https://${host}`;
      } catch (e) {
        return config.issuer;
      }
    }

    if (config.authorization_endpoint) {
      try {
        let url = new URL(config.authorization_endpoint);
        let host = url.hostname.split('.').slice(-2).join('.');
        return `https://${host}`;
      } catch (e) {
        return config.authorization_endpoint;
      }
    }

    return 'https://unknown-provider.metorial.com';
  }

  static async getConfigHash(config: OAuthConfiguration, scopes: string[]) {
    return await Hash.sha256(canonicalize(config) + canonicalize(scopes.sort()));
  }

  static supportsAuthRegistration(config: OAuthConfiguration) {
    return !!config.registration_endpoint;
  }

  static async registerClient({
    tenant,
    config,
    owner
  }: {
    tenant: Tenant;
    config: OAuthConfiguration;
    owner?: {
      connection?: RemoteOAuthConnection;
      config?: RemoteOAuthConfig;
    };
  }) {
    if (!config.registration_endpoint) return null;

    try {
      let clientName = `${tenant.name} (via Metorial)`;

      let response = await axios.post<RegistrationResponse>(
        config.registration_endpoint,
        {
          client_name: clientName,
          redirect_uris: [oauthCallbackUrl],
          grant_types: config.grant_types_supported,
          response_types: config.response_types_supported,
          token_endpoint_auth_method: 'client_secret_basic'
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'User-Agent': 'Metorial (https://metorial.com)'
          },
          maxRedirects: 5,
          timeout: 5000,
          ...getAxiosSsrfFilter(config.registration_endpoint)
        }
      );

      let data = response.data;

      let val = registrationResponseValidator.validate(data);
      if (!val.success) {
        throw new ServiceError(
          badRequestError({
            message: `Invalid registration response from ${config.registration_endpoint}`,
            details: val.errors
          })
        );
      }

      let regData = {
        ...data,
        client_id: data.client_id,
        client_secret: data.client_secret || undefined,
        client_id_issued_at: data.client_id_issued_at
          ? new Date(data.client_id_issued_at * 1000)
          : undefined,
        client_secret_expires_at: data.client_secret_expires_at
          ? new Date(data.client_secret_expires_at * 1000)
          : undefined,
        registration_access_token: data.registration_access_token || undefined,
        registration_client_uri: data.registration_client_uri
          ? new URL(data.registration_client_uri, config.registration_endpoint).toString()
          : undefined
      };

      let reg = await db.remoteOAuthAutoRegistration.create({
        data: {
          ...getId('remoteOAuthAutoRegistration'),
          data: regData,
          clientId: regData.client_id,
          clientSecret: regData.client_secret,
          registrationClientUri: regData.registration_client_uri,
          registrationAccessToken: regData.registration_access_token,
          clientSecretExpiresAt: regData.client_secret_expires_at,
          autoRegistrationName: clientName
        }
      });

      return {
        ok: true as const,
        registration: reg
      };
    } catch (error: any) {
      let err = await db.remoteOAuthRegistrationError.create({
        data: {
          ...getId('remoteOAuthRegistrationError'),
          endpoint: config.registration_endpoint,
          configOid: owner?.config?.oid || null,
          connectionOid: owner?.connection?.oid || null,

          payload: {
            error: error?.response?.data || error.message
          }
        }
      });

      Sentry.captureException(error, {
        extra: {
          registrationEndpoint: config.registration_endpoint,
          tenantId: tenant.id
        }
      });

      return {
        ok: false as const,
        error: err
      };
    }
  }
}
