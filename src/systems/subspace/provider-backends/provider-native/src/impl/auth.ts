import { badRequestError, ServiceError } from '@lowerdeck/error';
import {
  IProviderAuth,
  type GetDecryptedAuthConfigParam,
  type GetDecryptedAuthConfigRes,
  type ProviderAuthConfigCreateParam,
  type ProviderAuthConfigCreateRes,
  type ProviderAuthCredentialsCreateParam,
  type ProviderAuthCredentialsCreateRes,
  type ProviderOAuthSetupCreateParam,
  type ProviderOAuthSetupCreateRes,
  type ProviderOAuthSetupRetrieveParam,
  type ProviderOAuthSetupRetrieveRes
} from '@metorial-subspace/provider-utils';

let unsupportedAuthError = () =>
  new ServiceError(
    badRequestError({
      message: 'Native integrations do not support authentication configuration'
    })
  );

export class ProviderAuth extends IProviderAuth {
  override async createProviderAuthCredentials(
    _data: ProviderAuthCredentialsCreateParam
  ): Promise<ProviderAuthCredentialsCreateRes> {
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
}
