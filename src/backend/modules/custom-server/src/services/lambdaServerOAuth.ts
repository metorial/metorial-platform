import {
  LambdaServerInstance,
  ProviderOAuthConfig,
  ProviderOAuthConnection,
  ProviderOAuthConnectionAuthAttempt
} from '@metorial/db';
import { Service } from '@metorial/service';
import { getOAuthHandler } from '../deployment';
import { OAuthResponse } from '../deployment/base/oauthHandler';

class lambdaServerOAuthServiceImpl {
  async getOAuthForm(d: { lambda: LambdaServerInstance }) {
    return getOAuthHandler(d.lambda).getOAuthForm({});
  }

  async getOauthAuthorizationUrl(d: {
    lambda: LambdaServerInstance;
    connection: ProviderOAuthConnection & { config: ProviderOAuthConfig };
    authAttempt: ProviderOAuthConnectionAuthAttempt;
    fields: Record<string, any>;
    redirectUri: string;
  }) {
    return getOAuthHandler(d.lambda).getAuthorizationUrl({
      connection: d.connection,
      authAttempt: d.authAttempt,
      fields: d.fields,
      redirectUri: d.redirectUri
    });
  }

  async handleOAuthCallback(d: {
    fullUrl: string;
    redirectUri: string;
    lambda: LambdaServerInstance;
    response: OAuthResponse;
    connection: ProviderOAuthConnection & { config: ProviderOAuthConfig };
    authAttempt: ProviderOAuthConnectionAuthAttempt;
  }) {
    return getOAuthHandler(d.lambda).handleOAuthCallback({
      fullUrl: d.fullUrl,
      redirectUri: d.redirectUri,
      response: d.response,
      connection: d.connection,
      authAttempt: d.authAttempt
    });
  }

  async refreshOAuthToken(d: {
    lambda: LambdaServerInstance;
    connection: ProviderOAuthConnection & { config: ProviderOAuthConfig };
    refreshToken: string;
    redirectUri: string;
    additionalAuthData: Record<string, any>;
  }) {
    return getOAuthHandler(d.lambda).refreshOAuthToken({
      connection: d.connection,
      refreshToken: d.refreshToken,
      redirectUri: d.redirectUri,
      additionalAuthData: d.additionalAuthData
    });
  }
}

export let lambdaServerOAuthService = Service.create(
  'lambdaServerOAuth',
  () => new lambdaServerOAuthServiceImpl()
).build();
