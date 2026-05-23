import { ServiceError, badRequestError } from '@mtsrc/error';
import {
  IProviderDeployment,
  type ProviderConfigDeleteParam,
  type ProviderConfigDeleteRes,
  type ProviderConfigCreateParam,
  type ProviderConfigCreateRes,
  type ProviderDeploymentDeleteParam,
  type ProviderDeploymentDeleteRes,
  type ProviderDeploymentCreateParam,
  type ProviderDeploymentCreateRes,
  type ValidateNetworkingRulesetIdsParam,
  type ValidateNetworkingRulesetIdsRes
} from '@metorial-subspace/provider-utils';

export class ProviderDeployment extends IProviderDeployment {
  override async validateNetworkingRulesetIds(
    _data: ValidateNetworkingRulesetIdsParam
  ): Promise<ValidateNetworkingRulesetIdsRes> {
    throw new ServiceError(
      badRequestError({
        message: 'Networking rulesets cannot be assigned to native integrations'
      })
    );
  }

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
