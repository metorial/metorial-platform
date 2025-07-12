import { canonicalize } from '@metorial/canonicalize';
import { OAuthConnectionAuthToken } from '@metorial/db';
import { badRequestError, ServiceError } from '@metorial/error';
import { Hash } from '@metorial/hash';
import { getSentry } from '@metorial/sentry';
import axios from 'axios';
import { customAlphabet } from 'nanoid';
import { OAuthConfiguration, TokenResponse } from '../types';
import { getAxiosSsrfFilter } from './ssrfProtection';

let id = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 21);

let Sentry = getSentry();

export class OAuthUtils {
  static generateState(): string {
    return this.generateRandomString(32);
  }

  static generateCodeVerifier(): string {
    return this.generateRandomString(128);
  }

  static async generateCodeChallenge(verifier: string): Promise<string> {
    let encoder = new TextEncoder();
    let data = encoder.encode(verifier);
    let digest = await crypto.subtle.digest('SHA-256', data);
    return this.base64UrlEncode(new Uint8Array(digest));
  }

  private static generateRandomString(length: number): string {
    return id(length);
  }

  private static base64UrlEncode(buffer: Uint8Array): string {
    let base64 = btoa(String.fromCharCode(...buffer));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  static buildAuthorizationUrl(
    authEndpoint: string,
    clientId: string,
    redirectUri: string,
    scopes: string[],
    state?: string,
    codeChallenge?: string
  ): string {
    let url = new URL(authEndpoint);

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

  static async exchangeCodeForTokens(
    tokenEndpoint: string,
    clientId: string,
    clientSecret: string,
    code: string,
    redirectUri: string,
    codeVerifier?: string
  ): Promise<TokenResponse> {
    let body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId
    });

    if (codeVerifier) {
      body.set('code_verifier', codeVerifier);
    }

    try {
      let response = await axios.post<TokenResponse>(tokenEndpoint, body.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
          Accept: 'application/json'
        },
        ...getAxiosSsrfFilter(tokenEndpoint)
      });

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

  static isTokenExpired(token: OAuthConnectionAuthToken): boolean {
    if (!token.expiresAt) {
      return false;
    }

    return new Date() >= token.expiresAt;
  }

  static async refreshAccessToken(
    tokenEndpoint: string,
    clientId: string,
    clientSecret: string,
    refreshToken: string
  ): Promise<TokenResponse> {
    let body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId
    });

    try {
      let response = await axios.post<TokenResponse>(tokenEndpoint, body.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
          Accept: 'application/json'
        },
        ...getAxiosSsrfFilter(tokenEndpoint)
      });
      return response.data;
    } catch (error: any) {
      Sentry.captureException(error, {
        extra: {
          tokenEndpoint,
          clientId
        }
      });
      let errorMessage = error.response?.data?.error_description || error.message;
      throw new ServiceError(
        badRequestError({
          message: `Token refresh failed: ${error.response?.status ?? 'unknown'} ${errorMessage}`
        })
      );
    }
  }

  static async getUserProfile(
    userInfoEndpoint: string,
    accessToken: string
  ): Promise<Record<string, any>> {
    try {
      let response = await axios.get(userInfoEndpoint, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json'
        }
      });

      return response.data;
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

  static tokenResponseToPrismaToken(tokenResponse: TokenResponse) {
    let expiresAt = tokenResponse.expires_in
      ? new Date(Date.now() + tokenResponse.expires_in * 1000)
      : undefined;

    return {
      accessToken: tokenResponse.access_token,
      tokenType: tokenResponse.token_type,
      expiresAt: expiresAt === undefined ? null : expiresAt,
      refreshToken:
        tokenResponse.refresh_token === undefined ? null : tokenResponse.refresh_token,
      idToken: tokenResponse.id_token === undefined ? null : tokenResponse.id_token,
      scope: tokenResponse.scope === undefined ? null : tokenResponse.scope
    } satisfies Partial<OAuthConnectionAuthToken>;
  }

  static getProviderName(config: OAuthConfiguration): string {
    if (config.issuer) {
      try {
        let url = new URL(config.issuer);
        return url.hostname.split('.').slice(-2).join('.');
      } catch (e) {
        return config.issuer;
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

  static async getConfigHash(config: OAuthConfiguration) {
    return await Hash.sha256(canonicalize(config));
  }
}
