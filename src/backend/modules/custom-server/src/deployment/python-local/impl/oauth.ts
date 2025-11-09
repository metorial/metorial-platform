import { createCachedFunction } from '@metorial/cache';
import {
  ProviderOAuthConfig,
  ProviderOAuthConnection,
  ProviderOAuthConnectionAuthAttempt
} from '@metorial/db';
import { badRequestError, ServiceError } from '@metorial/error';
import { getAxiosSsrfFilter } from '@metorial/ssrf';
import axios from 'axios';
import { OAuthHandler, OAuthResponse } from '../../base/oauthHandler';

let getFormCached = createCachedFunction({
  name: 'crv/lpyt/form1',
  provider: async (i: { securityToken: string; httpEndpoint: string }) => {
    let form = await axios.post<{
      authForm: { fields: any[] };
    }>(
      `${i.httpEndpoint}/oauth/authorization-form`,
      { input: {} },
      {
        ...getAxiosSsrfFilter(i.httpEndpoint),
        headers: {
          'metorial-stellar-token': i.securityToken
        }
      }
    );
    return form.data.authForm;
  },
  ttlSeconds: 60 * 5,
  getHash: i => i.httpEndpoint
});

export class PythonOAuthHandler extends OAuthHandler {
  async getOAuthForm(d: {}): Promise<{ fields: any[] }> {
    let endpoint = this.lambda.providerResourceAccessIdentifier;
    if (!endpoint) throw new Error('WTF - no endpoint for lambda server instance');

    return getFormCached({
      securityToken: this.lambda.securityToken,
      httpEndpoint: endpoint
    });
  }

  async getAuthorizationUrl(d: {
    connection: ProviderOAuthConnection & { config: ProviderOAuthConfig };
    authAttempt: ProviderOAuthConnectionAuthAttempt;
    fields: Record<string, any>;
    redirectUri: string;
  }): Promise<{ authorizationUrl: string; codeVerifier: string }> {
    let endpoint = this.lambda.providerResourceAccessIdentifier;
    if (!endpoint) throw new Error('WTF - no endpoint for lambda server instance');

    let authUrlRes = await axios.post<{
      authorizationUrl: string;
      codeVerifier: string;
      success: boolean;
    }>(
      `${endpoint}/oauth/authorization-url`,
      {
        input: {
          fields: d.fields ?? {},
          clientId: d.connection.clientId,
          clientSecret: d.connection.clientSecret,
          state: d.authAttempt.stateIdentifier,
          redirectUri: d.redirectUri
        }
      },
      {
        ...getAxiosSsrfFilter(endpoint),
        headers: {
          'metorial-stellar-token': this.lambda.securityToken
        }
      }
    );
    if (authUrlRes.status !== 200 || !authUrlRes.data.success) {
      throw new ServiceError(
        badRequestError({
          message: 'Failed to fetch authorization URL from remote server'
        })
      );
    }

    return {
      authorizationUrl: authUrlRes.data.authorizationUrl,
      codeVerifier: authUrlRes.data.codeVerifier
    };
  }

  async handleOAuthCallback(d: {
    fullUrl: string;
    redirectUri: string;
    response: OAuthResponse;
    connection: ProviderOAuthConnection & { config: ProviderOAuthConfig };
    authAttempt: ProviderOAuthConnectionAuthAttempt;
  }): Promise<Record<string, any>> {
    let endpoint = this.lambda.providerResourceAccessIdentifier;
    if (!endpoint) throw new Error('WTF - no endpoint for lambda server instance');

    let tokenRes = await axios.post<{
      authData: Record<any, any>;
    }>(
      `${endpoint}/oauth/callback`,
      {
        input: {
          fields: d.authAttempt.additionalValues || {},
          code: d.response.code!,
          state: d.response.state!,
          clientId: d.connection.clientId!,
          clientSecret: d.connection.clientSecret,
          redirectUri: d.redirectUri,
          fullUrl: d.fullUrl,
          codeVerifier: d.authAttempt.codeVerifier
        }
      },
      {
        ...getAxiosSsrfFilter(endpoint!),
        headers: {
          'metorial-stellar-token': this.lambda.securityToken
        }
      }
    );

    return tokenRes.data.authData;
  }

  async refreshOAuthToken(d: {
    connection: ProviderOAuthConnection & { config: ProviderOAuthConfig };
    refreshToken: string;
    redirectUri: string;
    additionalAuthData: Record<string, any>;
  }): Promise<Record<string, any>> {
    let endpoint = this.lambda.providerResourceAccessIdentifier;
    if (!endpoint) throw new Error('WTF - no endpoint for lambda server instance');

    let tokenRes = await axios.post<{
      authData: Record<any, any>;
    }>(
      `${endpoint}/oauth/refresh`,
      {
        input: {
          redirectUri: d.redirectUri,
          refreshToken: d.refreshToken,
          clientId: d.connection.clientId!,
          clientSecret: d.connection.clientSecret,
          fields: d.additionalAuthData
        }
      },
      {
        ...getAxiosSsrfFilter(endpoint!),
        headers: {
          'metorial-stellar-token': this.lambda.securityToken
        }
      }
    );

    return tokenRes.data.authData;
  }
}
