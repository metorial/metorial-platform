import {
  IProviderDeployment,
  type ProviderConfigDeleteParam,
  type ProviderConfigDeleteRes,
  type ProviderConfigCreateParam,
  type ProviderConfigCreateRes,
  type ProviderDeploymentDeleteParam,
  type ProviderDeploymentDeleteRes,
  type ProviderDeploymentCreateParam,
  type ProviderDeploymentCreateRes
} from '@metorial-subspace/provider-utils';

export class ProviderDeployment extends IProviderDeployment {
  override async createProviderDeployment(
    _data: ProviderDeploymentCreateParam
  ): Promise<ProviderDeploymentCreateRes> {
    return {};
  }

  override async deleteProviderDeployment(
    _data: ProviderDeploymentDeleteParam
  ): Promise<ProviderDeploymentDeleteRes> {
    return {};
  }

  override async createProviderConfig(
    _data: ProviderConfigCreateParam
  ): Promise<ProviderConfigCreateRes> {
    return {};
  }

  override async deleteProviderConfig(
    _data: ProviderConfigDeleteParam
  ): Promise<ProviderConfigDeleteRes> {
    return {};
  }
}
