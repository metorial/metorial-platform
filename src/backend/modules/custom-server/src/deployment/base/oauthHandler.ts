import {
  LambdaServerInstance,
  ProviderOAuthConfig,
  ProviderOAuthConnection,
  ProviderOAuthConnectionAuthAttempt
} from '@metorial/db';

export type OAuthResponse = {
  code?: string;
  state?: string;
  error?: string;
  errorDescription?: string;
};

export type TokenResponse = {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  id_token?: string;
  scope?: string;
};

export abstract class OAuthHandler {
  constructor(public readonly lambda: LambdaServerInstance) {}

  abstract getOAuthForm(d: {}): Promise<{
    fields: any[];
  }>;

  abstract getAuthorizationUrl(d: {
    connection: ProviderOAuthConnection & { config: ProviderOAuthConfig };
    authAttempt: ProviderOAuthConnectionAuthAttempt;
    fields: Record<string, any>;
    redirectUri: string;
  }): Promise<{
    authorizationUrl: string;
    codeVerifier: string;
  }>;

  abstract handleOAuthCallback(d: {
    fullUrl: string;
    redirectUri: string;
    response: OAuthResponse;
    connection: ProviderOAuthConnection & { config: ProviderOAuthConfig };
    authAttempt: ProviderOAuthConnectionAuthAttempt;
  }): Promise<Record<string, any>>;

  abstract refreshOAuthToken(d: {
    connection: ProviderOAuthConnection & { config: ProviderOAuthConfig };
    refreshToken: string;
    redirectUri: string;
    additionalAuthData: Record<string, any>;
  }): Promise<Record<string, any>>;
}
