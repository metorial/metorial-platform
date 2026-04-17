import { badRequestError, ServiceError } from '@lowerdeck/error';
import {
  IProviderAuth,
  type GetDecryptedAuthConfigParam,
  type GetDecryptedAuthConfigRes,
  type GetProviderAuthConfigScopesParam,
  type GetProviderAuthCredentialsScopesParam,
  type GetProviderAuthScopesRes,
  type ProviderAuthConfigCreateParam,
  type ProviderAuthConfigCreateRes,
  type ProviderAuthConfigDeleteParam,
  type ProviderAuthConfigDeleteRes,
  type ProviderAuthCredentialsCreateParam,
  type ProviderAuthCredentialsCreateRes,
  type ProviderAuthCredentialsDeleteParam,
  type ProviderAuthCredentialsDeleteRes,
  type ProviderAuthCredentialsUpdateParam,
  type ProviderAuthCredentialsUpdateRes,
  type ProviderOAuthSetupCreateParam,
  type ProviderOAuthSetupCreateRes,
  type ProviderOAuthSetupRetrieveParam,
  type ProviderOAuthSetupRetrieveRes
} from '@metorial-subspace/provider-utils';

let unsupportedAuthError = () =>
  new ServiceError(
    badRequestError({
      message: 'This integration does not support authentication configuration'
    })
  );

export class ProviderAuth extends IProviderAuth {
  override async createProviderAuthCredentials(
    _data: ProviderAuthCredentialsCreateParam
  ): Promise<ProviderAuthCredentialsCreateRes> {
    throw unsupportedAuthError();
  }

  override async updateProviderAuthCredentials(
    _data: ProviderAuthCredentialsUpdateParam
  ): Promise<ProviderAuthCredentialsUpdateRes> {
    throw unsupportedAuthError();
  }

  override async deleteProviderAuthCredentials(
    _data: ProviderAuthCredentialsDeleteParam
  ): Promise<ProviderAuthCredentialsDeleteRes> {
    return {};
  }

  override async updateProviderAuthCredentials(
    _data: ProviderAuthCredentialsUpdateParam
  ): Promise<ProviderAuthCredentialsUpdateRes> {
    throw unsupportedAuthError();
  }

  override async createProviderOAuthSetup(
    _data: ProviderOAuthSetupCreateParam
  ): Promise<ProviderOAuthSetupCreateRes> {
    throw unsupportedAuthError();
  }

  override async createProviderAuthConfig(
    _data: ProviderAuthConfigCreateParam
  ): Promise<ProviderAuthConfigCreateRes> {
    throw unsupportedAuthError();
  }

  override async deleteProviderAuthConfig(
    _data: ProviderAuthConfigDeleteParam
  ): Promise<ProviderAuthConfigDeleteRes> {
    return {};
  }

  override async retrieveProviderOAuthSetup(
    _data: ProviderOAuthSetupRetrieveParam
  ): Promise<ProviderOAuthSetupRetrieveRes> {
    throw unsupportedAuthError();
  }

  override async getDecryptedAuthConfig(
    _data: GetDecryptedAuthConfigParam
  ): Promise<GetDecryptedAuthConfigRes> {
    throw unsupportedAuthError();
  }

  override async getProviderAuthCredentialsScopes(
    _data: GetProviderAuthCredentialsScopesParam
  ): Promise<GetProviderAuthScopesRes> {
    return { scopes: [] };
  }

  override async getProviderAuthConfigScopes(
    _data: GetProviderAuthConfigScopesParam
  ): Promise<GetProviderAuthScopesRes> {
    return { scopes: [] };
  }
}
