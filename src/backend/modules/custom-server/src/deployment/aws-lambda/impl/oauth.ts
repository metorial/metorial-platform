import {
  ProviderOAuthConfig,
  ProviderOAuthConnection,
  ProviderOAuthConnectionAuthAttempt
} from '@metorial/db';
import { OAuthHandler, OAuthResponse } from '../../base/oauthHandler';
import { invokeLambdaOAuth } from '../lib/invokeLambda';

export class AwsLambdaOAuthHandler extends OAuthHandler {
  async getAuthorizationUrl(d: {
    connection: ProviderOAuthConnection & { config: ProviderOAuthConfig };
    authAttempt: ProviderOAuthConnectionAuthAttempt;
    fields: Record<string, any>;
    redirectUri: string;
  }): Promise<{ authorizationUrl: string; codeVerifier: string }> {
    let res = await invokeLambdaOAuth({
      functionName: this.lambda.providerResourceAccessIdentifier!,
      oauthAction: 'authorization-url',
      input: {
        fields: d.fields ?? {},
        clientId: d.connection.clientId,
        clientSecret: d.connection.clientSecret,
        state: d.authAttempt.stateIdentifier,
        redirectUri: d.redirectUri
      }
    });

    return res.oauth!;
  }

  async getOAuthForm(d: {}): Promise<{ fields: any[] }> {
    let res = await invokeLambdaOAuth({
      functionName: this.lambda.providerResourceAccessIdentifier!,
      oauthAction: 'authorization-form',
      input: {}
    });

    return res.oauth.authForm;
  }

  async handleOAuthCallback(d: {
    fullUrl: string;
    redirectUri: string;
    response: OAuthResponse;
    connection: ProviderOAuthConnection & { config: ProviderOAuthConfig };
    authAttempt: ProviderOAuthConnectionAuthAttempt;
  }): Promise<Record<string, any>> {
    let res = await invokeLambdaOAuth({
      functionName: this.lambda.providerResourceAccessIdentifier!,
      oauthAction: 'callback',
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
    });

    return res.oauth.authData;
  }

  async refreshOAuthToken(d: {
    connection: ProviderOAuthConnection & { config: ProviderOAuthConfig };
    refreshToken: string;
    redirectUri: string;
    additionalAuthData: Record<string, any>;
  }): Promise<Record<string, any>> {
    let res = await invokeLambdaOAuth({
      functionName: this.lambda.providerResourceAccessIdentifier!,
      oauthAction: 'refresh',
      input: {
        redirectUri: d.redirectUri,
        refreshToken: d.refreshToken,
        clientId: d.connection.clientId!,
        clientSecret: d.connection.clientSecret,
        fields: d.additionalAuthData
      }
    });

    return res.oauth.authData;
  }
}
