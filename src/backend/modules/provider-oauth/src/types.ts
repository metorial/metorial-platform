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
  registration_endpoint?: string;
  // [key: string]: any;
}

export let oauthConfigValidator = v.object({
  issuer: v.optional(v.string()),
  authorization_endpoint: v.string({ modifiers: [v.url()] }),
  token_endpoint: v.string({ modifiers: [v.url()] }),
  userinfo_endpoint: v.optional(v.string({ modifiers: [v.url()] })),
  registration_endpoint: v.optional(v.string({ modifiers: [v.url()] }))
});

export interface CreateConnectionRequest {
  name: string;
  configuration: OAuthConfiguration;
  clientId: string;
  clientSecret: string;
  scopes: string[];
}

export interface TokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
  id_token?: string;
  scope?: string;
}

export let tokenResponseValidator = v.object({
  access_token: v.string(),
  token_type: v.optional(v.string()),
  expires_in: v.optional(v.number()),
  refresh_token: v.optional(v.string()),
  id_token: v.optional(v.string()),
  scope: v.optional(v.string())
});

export interface UserProfile {
  raw: Record<string, any>;
  sub: string;
  name?: string;
  email?: string;
}

export interface RegistrationResponse {
  client_id: string;
  client_secret?: string;
  client_id_issued_at?: number;
  client_secret_expires_at?: number;
  registration_access_token?: string;
  registration_client_uri?: string;
}

export let registrationResponseValidator = v.object({
  client_id: v.string(),
  client_secret: v.optional(v.string()),
  client_id_issued_at: v.optional(v.number()),
  client_secret_expires_at: v.optional(v.number()),
  registration_access_token: v.optional(v.string()),
  registration_client_uri: v.optional(v.string())
});
