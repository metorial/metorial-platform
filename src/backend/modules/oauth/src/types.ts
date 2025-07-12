import { v } from '@metorial/validation';

export interface OAuthConfiguration {
  issuer?: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint?: string;
  response_types_supported?: string[];
  scopes_supported?: string[];
  token_endpoint_auth_methods_supported?: string[];
  grant_types_supported?: string[];
  subject_types_supported?: string[];
  id_token_signing_alg_alg_values_supported?: string[];
  claims_supported?: string[];
  code_challenge_methods_supported?: string[];
  // [key: string]: any;
}

export let oauthConfigValidator = v.object({
  issuer: v.optional(v.string()),
  authorization_endpoint: v.string({ modifiers: [v.url()] }),
  token_endpoint: v.string({ modifiers: [v.url()] }),
  userinfo_endpoint: v.optional(v.string({ modifiers: [v.url()] }))
});

export interface CreateConnectionRequest {
  name: string;
  configuration: OAuthConfiguration;
  clientId: string;
  clientSecret: string;
  scopes: string[];
}

// export interface AuthState {
//   connectionId: string;
//   redirectUri: string;
//   state?: string;
//   codeVerifier?: string;
//   timestamp: number;
// }

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  id_token?: string;
  scope?: string;
}
