import type {
  Provider,
  ProviderAuthConfig,
  ProviderAuthConfigVersion,
  ProviderAuthCredentials,
  ProviderAuthCredentialsType,
  ProviderAuthMethod,
  ProviderOAuthSetup,
  ProviderVariant,
  ProviderVersion,
  ShuttleAuthConfig,
  ShuttleOAuthCredentials,
  ShuttleOAuthSetup,
  SlateAuthConfig,
  SlateOAuthCredentials,
  SlateOAuthSetup,
  Tenant
} from '@metorial-subspace/db';
import { IProviderFunctionality } from '../providerFunctionality';

export abstract class IProviderAuth extends IProviderFunctionality {
  abstract createProviderAuthCredentials(
    data: ProviderAuthCredentialsCreateParam
  ): Promise<ProviderAuthCredentialsCreateRes>;

  abstract createProviderOAuthSetup(
    data: ProviderOAuthSetupCreateParam
  ): Promise<ProviderOAuthSetupCreateRes>;

  abstract createProviderAuthConfig(
    data: ProviderAuthConfigCreateParam
  ): Promise<ProviderAuthConfigCreateRes>;

  abstract retrieveProviderOAuthSetup(
    data: ProviderOAuthSetupRetrieveParam
  ): Promise<ProviderOAuthSetupRetrieveRes>;

  abstract getDecryptedAuthConfig(
    data: GetDecryptedAuthConfigParam
  ): Promise<GetDecryptedAuthConfigRes>;
}

export interface ProviderAuthCredentialsCreateParam {
  tenant: Tenant;
  provider: Provider & { defaultVariant: ProviderVariant | null };
  input:
    | {
        type: 'oauth';
        clientId: string;
        clientSecret: string;
        scopes: string[];
      }
    | { type: 'auto_registration' };
}

export interface ProviderAuthCredentialsCreateRes {
  slateOAuthCredentials?: SlateOAuthCredentials;
  shuttleOAuthCredentials?: ShuttleOAuthCredentials;
  type: ProviderAuthCredentialsType;
  isAutoRegistration: boolean;
}

export interface ProviderAuthConfigCreateParam {
  tenant: Tenant;
  provider: Provider & { defaultVariant: ProviderVariant | null };
  providerVersion: ProviderVersion;
  authMethod: ProviderAuthMethod;
  input: Record<string, any>;
}

export interface ProviderAuthConfigCreateRes {
  slateAuthConfig?: SlateAuthConfig;
  shuttleAuthConfig?: ShuttleAuthConfig;
  expiresAt: Date | null;
}

export interface ProviderOAuthSetupCreateParam {
  tenant: Tenant;
  provider: Provider & { defaultVariant: ProviderVariant | null };
  providerVersion: ProviderVersion;
  credentials: ProviderAuthCredentials;
  authMethod: ProviderAuthMethod;
  redirectUrl: string;
  callbackUrlOverride: string | null;
  input: Record<string, any>;
}

export interface ProviderOAuthSetupCreateRes {
  slateOAuthSetup?: SlateOAuthSetup;
  shuttleOAuthSetup?: ShuttleOAuthSetup;
  url: string;
}

export interface ProviderOAuthSetupRetrieveParam {
  tenant: Tenant;
  setup: ProviderOAuthSetup;
}

export interface ProviderOAuthSetupRetrieveRes {
  slateOAuthSetup?: SlateOAuthSetup;
  slateAuthConfig?: SlateAuthConfig | null;

  shuttleOAuthSetup?: ShuttleOAuthSetup;
  shuttleAuthConfig?: ShuttleAuthConfig | null;

  status: 'pending' | 'completed' | 'failed';
  url: string | null;
  error: {
    code: string;
    message: string;
  } | null;
}

export interface GetDecryptedAuthConfigParam {
  tenant: Tenant;
  authConfig: ProviderAuthConfig;
  authConfigVersion: ProviderAuthConfigVersion;
  note: string;
}

export interface GetDecryptedAuthConfigRes {
  decryptedConfigData: Record<string, any>;
  expiresAt: Date | null;
}
