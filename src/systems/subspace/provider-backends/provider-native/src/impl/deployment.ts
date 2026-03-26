import { ServiceError, badRequestError } from '@lowerdeck/error';
import {
  IProviderDeployment,
  type ProviderConfigCreateParam,
  type ProviderConfigCreateRes,
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

  override async createProviderConfig(
    _data: ProviderConfigCreateParam
  ): Promise<ProviderConfigCreateRes> {
    return {};
  }
}
