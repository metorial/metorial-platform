import type {
  Provider,
  ProviderAuthConfig,
  ProviderAuthConfigVersion,
  ProviderAuthCredentials,
  ProviderAuthCredentialsType,
  ProviderAuthMethod,
  ProviderDeployment,
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

  abstract updateProviderAuthCredentials(
    data: ProviderAuthCredentialsUpdateParam
  ): Promise<ProviderAuthCredentialsUpdateRes>;

  abstract deleteProviderAuthCredentials(
    data: ProviderAuthCredentialsDeleteParam
  ): Promise<ProviderAuthCredentialsDeleteRes>;

  abstract createProviderOAuthSetup(
    data: ProviderOAuthSetupCreateParam
  ): Promise<ProviderOAuthSetupCreateRes>;

  abstract createProviderAuthConfig(
    data: ProviderAuthConfigCreateParam
  ): Promise<ProviderAuthConfigCreateRes>;

  abstract deleteProviderAuthConfig(
    data: ProviderAuthConfigDeleteParam
  ): Promise<ProviderAuthConfigDeleteRes>;

  abstract retrieveProviderOAuthSetup(
    data: ProviderOAuthSetupRetrieveParam
  ): Promise<ProviderOAuthSetupRetrieveRes>;

  abstract getDecryptedAuthConfig(
    data: GetDecryptedAuthConfigParam
  ): Promise<GetDecryptedAuthConfigRes>;

  abstract getProviderAuthCredentialsScopes(
    data: GetProviderAuthCredentialsScopesParam
  ): Promise<GetProviderAuthCredentialsScopesRes>;

  abstract getProviderAuthConfigScopes(
    data: GetProviderAuthConfigScopesParam
  ): Promise<GetProviderAuthConfigScopesRes>;

  async onProviderAuthConfigVersionCreated(
    data: ProviderAuthConfigVersionCreatedParam
  ): Promise<ProviderAuthConfigVersionCreatedRes> {
    return {};
  }

  async getManyProviderAuthCredentialsScopes(
    data: ProviderAuthCredentialsScopesParam
  ): Promise<ProviderAuthCredentialsScopesRes> {
    return { scopes: new Map() };
  }
}

export interface ProviderAuthCredentialsScopesParam {
  tenant: Tenant;
  backings: {
    id: string;
    slateCredentialsOid?: bigint | null;
    shuttleCredentialsOid?: bigint | null;
  }[];
}

export interface ProviderAuthCredentialsScopesRes {
  scopes: Map<string, string[]>;
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

export interface ProviderAuthCredentialsEditBacking {
  slateCredentialsOid?: bigint | null;
  shuttleCredentialsOid?: bigint | null;
}

export interface ProviderAuthCredentialsUpdateParam {
  tenant: Tenant;
  backing: ProviderAuthCredentialsEditBacking;
  input: {
    type?: 'oauth';
    clientId?: string;
    clientSecret?: string;
    scopes?: string[];
  };
}

export interface ProviderAuthCredentialsUpdateRes {}

export interface ProviderAuthCredentialsDeleteParam {
  tenant: Tenant;
  backing: ProviderAuthCredentialsEditBacking;
}

export interface ProviderAuthCredentialsDeleteRes {}

export interface ProviderAuthCredentialsUpdateRes {}

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

export interface ProviderAuthConfigVersionCreatedParam {
  tenant: Tenant;
  authConfig: ProviderAuthConfig;
  authConfigVersion: ProviderAuthConfigVersion;
}

export interface ProviderAuthConfigVersionCreatedRes {}

export interface ProviderAuthConfigDeleteBacking {
  slateAuthConfigOid?: bigint | null;
  shuttleAuthConfigOid?: bigint | null;
}

export interface ProviderAuthConfigDeleteParam {
  tenant: Tenant;
  backing: ProviderAuthConfigDeleteBacking;
}

export interface ProviderAuthConfigDeleteRes {}

export interface ProviderOAuthSetupCreateParam {
  tenant: Tenant;
  provider: Provider & { defaultVariant: ProviderVariant | null };
  providerVersion: ProviderVersion;
  providerDeployment?: ProviderDeployment | null;
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

export interface GetProviderAuthCredentialsScopesParam {
  tenant: Tenant;
  providerAuthCredentials: ProviderAuthCredentials;
}

export interface GetProviderAuthConfigScopesParam {
  tenant: Tenant;
  authConfigVersion: ProviderAuthConfigVersion;
}

export interface GetProviderAuthCredentialsScopesRes {
  scopes: string[];
}

export interface GetProviderAuthConfigScopesRes {
  scopes: string[] | null;
}
